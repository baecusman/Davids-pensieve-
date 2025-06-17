import { supabase } from "@/lib/database/supabase-client"
import { memoryCache } from "@/lib/cache/memory-cache"
import crypto from "crypto"

export class ContentService {
  private static instance: ContentService

  static getInstance(): ContentService {
    if (!ContentService.instance) {
      ContentService.instance = new ContentService()
    }
    return ContentService.instance
  }

  async storeContent(
    userId: string,
    data: {
      title: string
      url: string
      content: string
      source: string
    },
  ) {
    // Generate content hash for deduplication
    const hash = crypto
      .createHash("sha256")
      .update(data.url + data.content)
      .digest("hex")

    // Check if content already exists for this user
    const { data: existing } = await supabase
      .from("content")
      .select("id")
      .eq("user_id", userId)
      .eq("hash", hash)
      .single()

    if (existing) {
      return { contentId: existing.id, isNew: false }
    }

    // Store new content
    const { data: content, error } = await supabase
      .from("content")
      .insert({
        user_id: userId,
        title: data.title,
        url: data.url,
        content: data.content,
        source: data.source,
        hash,
      })
      .select("id")
      .single()

    if (error) {
      console.error("Error storing content:", error)
      throw new Error(`Failed to store content: ${error.message}`)
    }

    // Analyze content (mock analysis for now)
    await this.analyzeContent(userId, content.id, data.title, data.content, data.url)

    // Invalidate user content cache
    await this.invalidateUserContentCache(userId)

    return { contentId: content.id, isNew: true }
  }

  async analyzeContent(userId: string, contentId: string, title: string, content: string, url: string) {
    try {
      // Mock analysis - in production, this would call Grok API
      const analysis = {
        summary: {
          sentence: `Analysis of "${title}"`,
          paragraph: `This content discusses various topics and provides insights into the subject matter. Key themes include technology, innovation, and industry trends.`,
          isFullRead: false,
        },
        entities: [
          { name: "Technology", type: "concept" },
          { name: "Innovation", type: "concept" },
          { name: "AI", type: "technology" },
          { name: "Software", type: "technology" },
        ],
        tags: ["technology", "analysis", "innovation"],
        priority: "read",
        confidence: 0.8,
      }

      // Store analysis
      const { error } = await supabase.from("analysis").insert({
        user_id: userId,
        content_id: contentId,
        summary: analysis.summary,
        entities: analysis.entities,
        tags: analysis.tags,
        priority: analysis.priority,
        confidence: analysis.confidence,
      })

      if (error) {
        console.error("Error storing analysis:", error)
      }

      // Create concepts and relationships
      await this.processEntities(userId, contentId, analysis.entities)

      return analysis
    } catch (error) {
      console.error("Error analyzing content:", error)
    }
  }

  async processEntities(userId: string, contentId: string, entities: any[]) {
    try {
      const conceptIds: string[] = []

      for (const entity of entities) {
        // Try to find existing concept
        const { data: existingConcept } = await supabase
          .from("concepts")
          .select("id, frequency")
          .eq("user_id", userId)
          .eq("name", entity.name)
          .eq("type", entity.type)
          .single()

        let conceptId: string

        if (existingConcept) {
          // Update frequency
          await supabase
            .from("concepts")
            .update({ frequency: existingConcept.frequency + 1 })
            .eq("id", existingConcept.id)
          conceptId = existingConcept.id
        } else {
          // Create new concept
          const { data: newConcept, error } = await supabase
            .from("concepts")
            .insert({
              user_id: userId,
              name: entity.name,
              type: entity.type,
              frequency: 1,
            })
            .select("id")
            .single()

          if (error) {
            console.error("Error creating concept:", error)
            continue
          }
          conceptId = newConcept.id
        }

        conceptIds.push(conceptId)
      }

      // Create relationships between concepts
      for (let i = 0; i < conceptIds.length; i++) {
        for (let j = i + 1; j < conceptIds.length; j++) {
          await supabase.from("relationships").upsert(
            {
              user_id: userId,
              from_concept_id: conceptIds[i],
              to_concept_id: conceptIds[j],
              content_id: contentId,
              type: "RELATES_TO",
              strength: 0.5,
            },
            {
              onConflict: "user_id,from_concept_id,to_concept_id,content_id",
              ignoreDuplicates: true,
            },
          )
        }
      }
    } catch (error) {
      console.error("Error processing entities:", error)
    }
  }

  async getUserContent(
    userId: string,
    options: {
      page?: number
      limit?: number
      source?: string
      priority?: string
      timeframe?: "weekly" | "monthly" | "quarterly"
    } = {},
  ) {
    const page = options.page || 1
    const limit = options.limit || 50
    const offset = (page - 1) * limit

    // Try cache first
    const cacheKey = `user-content:${userId}:${page}:${limit}:${options.source || ""}:${options.priority || ""}:${options.timeframe || ""}`
    const cached = memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    // Build query
    let query = supabase
      .from("content")
      .select(`
        *,
        analysis:analysis(*)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (options.source) {
      query = query.eq("source", options.source)
    }

    if (options.timeframe) {
      const cutoff = this.getTimeframeCutoff(options.timeframe)
      query = query.gte("created_at", cutoff.toISOString())
    }

    const { data: content, error } = await query

    if (error) {
      console.error("Error getting user content:", error)
      return { items: [], total: 0, hasMore: false, page, totalPages: 0 }
    }

    // Get total count
    const { count: total } = await supabase
      .from("content")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    const result = {
      items: (content || []).map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        content: item.content,
        source: item.source,
        createdAt: item.created_at,
        analysis: item.analysis?.[0] || null,
      })),
      total: total || 0,
      hasMore: offset + limit < (total || 0),
      page,
      totalPages: Math.ceil((total || 0) / limit),
    }

    // Cache for 5 minutes
    memoryCache.set(cacheKey, result, 300)

    return result
  }

  async getConceptMap(userId: string, abstractionLevel = 50, searchQuery = "") {
    const cacheKey = `concept-map:${userId}:${abstractionLevel}:${searchQuery}`
    const cached = memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    // Get concepts with frequency filtering
    let conceptsQuery = supabase
      .from("concepts")
      .select("*")
      .eq("user_id", userId)
      .order("frequency", { ascending: false })

    if (searchQuery) {
      conceptsQuery = conceptsQuery.ilike("name", `%${searchQuery}%`)
    }

    const { data: concepts, error } = await conceptsQuery

    if (error) {
      console.error("Error getting concepts:", error)
      return { nodes: [], edges: [] }
    }

    if (!concepts || concepts.length === 0) {
      return { nodes: [], edges: [] }
    }

    // Calculate max frequency for density calculation
    const maxFrequency = Math.max(...concepts.map((c) => c.frequency), 1)

    // Apply abstraction level filtering
    const minFrequency = Math.max(1, Math.floor((abstractionLevel / 100) * maxFrequency))
    const filteredConcepts = concepts.filter((c) => c.frequency >= minFrequency)

    // Get relationships for these concepts
    const conceptIds = filteredConcepts.map((c) => c.id)
    const { data: relationships, error: relError } = await supabase
      .from("relationships")
      .select("*")
      .eq("user_id", userId)
      .in("from_concept_id", conceptIds)
      .in("to_concept_id", conceptIds)

    if (relError) {
      console.error("Error getting relationships:", relError)
      return { nodes: [], edges: [] }
    }

    // Transform to graph format
    const nodes = filteredConcepts.map((concept) => ({
      id: concept.id,
      label: concept.name,
      type: concept.type,
      frequency: concept.frequency,
      density: this.calculateNodeDensity(concept.frequency, maxFrequency),
      description: concept.description || `${concept.type} mentioned ${concept.frequency} times`,
    }))

    const edges = (relationships || []).map((rel) => ({
      id: rel.id,
      source: rel.from_concept_id,
      target: rel.to_concept_id,
      type: rel.type,
      weight: rel.strength,
    }))

    const result = { nodes, edges }

    // Cache for 10 minutes if no search query
    if (!searchQuery) {
      memoryCache.set(cacheKey, result, 600)
    }

    return result
  }

  private calculateNodeDensity(frequency: number, maxFrequency: number): number {
    if (maxFrequency <= 1) return 50
    return Math.min(100, Math.max(10, (frequency / maxFrequency) * 100))
  }

  private getTimeframeCutoff(timeframe: "weekly" | "monthly" | "quarterly"): Date {
    const now = new Date()
    const cutoff = new Date()

    switch (timeframe) {
      case "weekly":
        cutoff.setDate(now.getDate() - 7)
        break
      case "monthly":
        cutoff.setMonth(now.getMonth() - 1)
        break
      case "quarterly":
        cutoff.setMonth(now.getMonth() - 3)
        break
    }

    return cutoff
  }

  private async invalidateUserContentCache(userId: string) {
    // In a real implementation, this would invalidate all cache keys for this user
    memoryCache.clear()
  }
}

export const contentService = ContentService.getInstance()
