import { mockDb } from "@/lib/database/mock-db"
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

    // Check if content already exists (simplified check)
    const existingContent = await mockDb.getContent(userId, { limit: 1000 })
    const existing = existingContent.items.find((item) => item.hash === hash)

    if (existing) {
      return { contentId: existing.id, isNew: false }
    }

    // Store new content
    const content = await mockDb.createContent({
      userId,
      title: data.title,
      url: data.url,
      content: data.content,
      source: data.source,
      hash,
    })

    // Analyze content
    await this.analyzeContent(userId, content.id, data.title, data.content, data.url)

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
        priority: "read" as const,
        confidence: 0.8,
      }

      // Store analysis
      await mockDb.createAnalysis({
        userId,
        contentId,
        summary: analysis.summary,
        entities: analysis.entities,
        tags: analysis.tags,
        priority: analysis.priority,
        confidence: analysis.confidence,
      })

      return analysis
    } catch (error) {
      console.error("Error analyzing content:", error)
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
    const cacheKey = `user-content:${userId}:${JSON.stringify(options)}`
    const cached = memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    const result = await mockDb.getContent(userId, options)

    // Transform to expected format
    const transformedResult = {
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        content: item.content,
        source: item.source,
        createdAt: item.createdAt,
        analysis: item.analysis || null,
      })),
      total: result.total,
      hasMore: result.hasMore,
      page: result.page,
      totalPages: result.totalPages,
    }

    // Cache for 5 minutes
    memoryCache.set(cacheKey, transformedResult, 300)

    return transformedResult
  }

  async getConceptMap(userId: string, abstractionLevel = 50, searchQuery = "") {
    const cacheKey = `concept-map:${userId}:${abstractionLevel}:${searchQuery}`
    const cached = memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    // Get concepts
    const concepts = await mockDb.getConcepts(userId, { search: searchQuery })

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
    const relationships = await mockDb.getRelationships(userId, conceptIds)

    // Transform to graph format
    const nodes = filteredConcepts.map((concept) => ({
      id: concept.id,
      label: concept.name,
      type: concept.type,
      frequency: concept.frequency,
      density: this.calculateNodeDensity(concept.frequency, maxFrequency),
      description: concept.description || `${concept.type} mentioned ${concept.frequency} times`,
    }))

    const edges = relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromConceptId,
      target: rel.toConceptId,
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
}

export const contentService = ContentService.getInstance()
