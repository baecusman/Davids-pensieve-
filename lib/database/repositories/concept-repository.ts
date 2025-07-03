import { supabase } from "../../auth/supabase"
import type { ConceptEntity, RelationshipEntity, ContentEntity, AnalysisEntity } from "../schema"

export class ConceptRepository {
  async findById(id: string): Promise<ConceptEntity | null> {
    const { data, error } = await supabase
      .from<ConceptEntity>("concepts")
      .select("*")
      .eq("id", id)
      .single()
    if (error) {
      console.error("Error fetching concept by id:", error)
      return null
    }
    return data
  }

  async findByName(name: string): Promise<ConceptEntity | null> {
    const { data, error } = await supabase
      .from<ConceptEntity>("concepts")
      .select("*")
      .eq("name", name)
      .single()
    if (error) {
      console.error("Error fetching concept by name:", error)
      return null
    }
    return data
  }

  async findByType(type: ConceptEntity["type"]): Promise<ConceptEntity[]> {
    const { data, error } = await supabase
      .from<ConceptEntity>("concepts")
      .select("*")
      .eq("type", type)
    if (error) {
      console.error("Error fetching concepts by type:", error)
      return []
    }
    return data || []
  }

  async findAll(): Promise<ConceptEntity[]> {
    const { data, error } = await supabase
      .from<ConceptEntity>("concepts")
      .select("*")
      .order("frequency", { ascending: false })
    if (error) {
      console.error("Error fetching all concepts:", error)
      return []
    }
    return data || []
  }

  async searchConcepts(query: string): Promise<ConceptEntity[]> {
    const { data, error } = await supabase
      .from<ConceptEntity>("concepts")
      .select("*")
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    if (error) {
      console.error("Error searching concepts:", error)
      return []
    }
    return data || []
  }

  async getConceptGraph(minFrequency = 1): Promise<{
    nodes: Array<ConceptEntity & { density: number }>
    edges: Array<RelationshipEntity & { weight: number }>
  }> {
    const concepts = (await this.findAll()).filter((c) => c.frequency >= minFrequency)
    const conceptIds = concepts.map((c) => c.id)

    if (conceptIds.length === 0) {
      return { nodes: [], edges: [] }
    }

    const maxFrequency = Math.max(...concepts.map((c) => c.frequency), 1)
    const nodes = concepts.map((concept) => ({
      ...concept,
      density: Math.min(100, (concept.frequency / maxFrequency) * 100),
    }))

    const { data: allRelationships, error: relError } = await supabase
      .from<RelationshipEntity>("relationships")
      .select("*")
      .in("fromConceptId", conceptIds)
      .in("toConceptId", conceptIds)

    if (relError) {
      console.error("Error fetching relationships for concept graph:", relError)
      return { nodes, edges: [] }
    }

    const edges = (allRelationships || []).map((rel) => ({
      ...rel,
      weight: rel.strength,
    }))

    return { nodes, edges }
  }

  async getRelatedConcepts(conceptId: string, limit = 10): Promise<ConceptEntity[]> {
    const { data: outgoingRels, error: outError } = await supabase
      .from<RelationshipEntity>("relationships")
      .select("toConceptId")
      .eq("fromConceptId", conceptId)

    if (outError) {
      console.error("Error fetching outgoing relationships:", outError)
      return []
    }

    const { data: incomingRels, error: inError } = await supabase
      .from<RelationshipEntity>("relationships")
      .select("fromConceptId")
      .eq("toConceptId", conceptId)

    if (inError) {
      console.error("Error fetching incoming relationships:", inError)
      return []
    }

    const relatedIds = new Set<string>()
    outgoingRels?.forEach((rel) => relatedIds.add(rel.toConceptId))
    incomingRels?.forEach((rel) => relatedIds.add(rel.fromConceptId))

    if (relatedIds.size === 0) return []

    const { data: relatedConcepts, error: conceptError } = await supabase
      .from<ConceptEntity>("concepts")
      .select("*")
      .in("id", Array.from(relatedIds))
      .order("frequency", { ascending: false })
      .limit(limit)

    if (conceptError) {
      console.error("Error fetching related concepts:", conceptError)
      return []
    }
    return relatedConcepts || []
  }

  async getConceptDetails(conceptId: string): Promise<{
    concept: ConceptEntity | null
    relatedConcepts: ConceptEntity[]
    articles: Array<{ content: ContentEntity; analysis: AnalysisEntity }>
    relationshipStats: {
      incoming: number
      outgoing: number
      types: Record<string, number>
    }
  }> {
    const concept = await this.findById(conceptId)
    if (!concept) {
      return {
        concept: null,
        relatedConcepts: [],
        articles: [],
        relationshipStats: { incoming: 0, outgoing: 0, types: {} },
      }
    }

    const relatedConcepts = await this.getRelatedConcepts(conceptId, 5)

    // Find analyses that mention this concept
    const { data: analyses, error: analysisError } = await supabase
      .from<AnalysisEntity>("analysis")
      .select("*, content!inner(*)") // Assuming 'content' is a related table/view
      .or(`entities.cs.{${concept.name}},tags.cs.{${concept.name}}`) // This syntax might need adjustment based on how entities/tags are stored (e.g., JSONB array)

    if (analysisError) {
      console.error("Error fetching analyses for concept details:", analysisError)
    }

    const articles: Array<{ content: ContentEntity; analysis: AnalysisEntity }> = []
    if (analyses) {
        for (const analysis of analyses) {
            // The content should already be joined if the query is correct.
            // If not, an additional query for content would be needed here.
            // This part assumes 'content' is directly available or joined.
            // If 'analysis.content' is the ContentEntity:
            if (analysis.content) { // Check if content is actually joined
                 articles.push({ content: analysis.content as ContentEntity, analysis });
            } else {
                // Fallback or specific handling if content is not directly joined
                const { data: contentData, error: contentError } = await supabase
                    .from<ContentEntity>('content')
                    .select('*')
                    .eq('id', analysis.contentId)
                    .single();
                if (contentData && !contentError) {
                    articles.push({ content: contentData, analysis });
                } else if (contentError) {
                    console.error("Error fetching content for analysis:", contentError.message);
                }
            }
        }
    }


    // Calculate relationship stats
    const { count: incomingCount, error: inError } = await supabase
      .from<RelationshipEntity>("relationships")
      .select("id", { count: "exact" })
      .eq("toConceptId", conceptId)

    const { count: outgoingCount, error: outError } = await supabase
      .from<RelationshipEntity>("relationships")
      .select("id", { count: "exact" })
      .eq("fromConceptId", conceptId)

    const { data: allRelsData, error: typesError } = await supabase
        .from<RelationshipEntity>("relationships")
        .select("type")
        .or(`fromConceptId.eq.${conceptId},toConceptId.eq.${conceptId}`)

    const types: Record<string, number> = {}
    if (typesError) {
        console.error("Error fetching relationship types:", typesError)
    } else if (allRelsData) {
        allRelsData.forEach((rel) => {
            types[rel.type] = (types[rel.type] || 0) + 1
        })
    }


    return {
      concept,
      relatedConcepts,
      articles,
      relationshipStats: {
        incoming: inError ? 0 : incomingCount || 0,
        outgoing: outError ? 0 : outgoingCount || 0,
        types,
      },
    }
  }

  async getTrendingConcepts(
    timeframe: "weekly" | "monthly" | "quarterly",
    limit = 10,
  ): Promise<Array<{
    concept: ConceptEntity
    growth: number
    recentMentions: number
  }>> {
    const now = new Date()
    const cutoffDate = new Date()

    switch (timeframe) {
      case "weekly":
        cutoffDate.setDate(now.getDate() - 7)
        break
      case "monthly":
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case "quarterly":
        cutoffDate.setMonth(now.getMonth() - 3)
        break
    }

    const { data: recentContent, error: contentError } = await supabase
      .from<ContentEntity>("content")
      .select("id")
      .gte("createdAt", cutoffDate.toISOString())

    if (contentError) {
      console.error("Error fetching recent content for trending concepts:", contentError)
      return []
    }
    if (!recentContent || recentContent.length === 0) return []

    const recentContentIds = recentContent.map((c) => c.id)

    const { data: recentAnalyses, error: analysisError } = await supabase
      .from<AnalysisEntity>("analysis")
      .select("entities, tags") // Assuming entities is an array of objects with 'name'
      .in("contentId", recentContentIds)

    if (analysisError) {
      console.error("Error fetching recent analyses for trending concepts:", analysisError)
      return []
    }

    const conceptCounts = new Map<string, number>()
    recentAnalyses?.forEach((analysis) => {
      analysis.entities?.forEach((entity: any) => { // Consider defining a more specific type for entity if possible
        if (entity && typeof entity.name === 'string') {
            conceptCounts.set(entity.name, (conceptCounts.get(entity.name) || 0) + 1)
        }
      })
      analysis.tags?.forEach((tag: string) => {
         if (typeof tag === 'string') {
            conceptCounts.set(tag, (conceptCounts.get(tag) || 0) + 1)
         }
      })
    })

    const trendingResults: Array<{
      concept: ConceptEntity
      growth: number
      recentMentions: number
    }> = []

    for (const [name, recentMentions] of conceptCounts.entries()) {
      const concept = await this.findByName(name)
      if (!concept) continue

      const historicalRate = concept.frequency / Math.max(1, concept.frequency) // Avoid division by zero, though frequency should be > 0
      const recentRate = recentMentions / Math.max(1, recentContent.length)
      const growth = recentRate / Math.max(0.01, historicalRate) // Avoid division by zero for historicalRate

      trendingResults.push({
        concept,
        growth,
        recentMentions,
      })
    }

    return trendingResults.sort((a, b) => b.growth - a.growth).slice(0, limit)
  }

  async updateConceptDescription(id: string, description: string): Promise<boolean> {
    const { error } = await supabase
      .from<ConceptEntity>("concepts")
      .update({ description, updatedAt: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      console.error("Error updating concept description:", error)
      return false
    }
    return true
  }

  async mergeConceptByConcepts(sourceId: string, targetId: string): Promise<boolean> {
    const sourceConcept = await this.findById(sourceId)
    const targetConcept = await this.findById(targetId)

    if (!sourceConcept || !targetConcept) return false

    // Start a transaction if your Supabase setup supports it easily, or handle rollback manually
    // For simplicity, proceeding with individual calls. Consider Supabase functions for atomicity.

    const { error: outgoingError } = await supabase
      .from<RelationshipEntity>("relationships")
      .update({ fromConceptId: targetId, updatedAt: new Date().toISOString() })
      .eq("fromConceptId", sourceId)
    if (outgoingError) {
      console.error("Error updating outgoing relationships for merge:", outgoingError)
      return false // Potentially rollback previous changes if in a transaction
    }

    const { error: incomingError } = await supabase
      .from<RelationshipEntity>("relationships")
      .update({ toConceptId: targetId, updatedAt: new Date().toISOString() })
      .eq("toConceptId", sourceId)
    if (incomingError) {
      console.error("Error updating incoming relationships for merge:", incomingError)
      return false // Potentially rollback
    }

    const { error: freqError } = await supabase
      .from<ConceptEntity>("concepts")
      .update({
        frequency: targetConcept.frequency + sourceConcept.frequency,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", targetId)
    if (freqError) {
      console.error("Error updating target concept frequency for merge:", freqError)
      return false // Potentially rollback
    }

    const { error: deleteError } = await supabase
      .from<ConceptEntity>("concepts")
      .delete()
      .eq("id", sourceId)
    if (deleteError) {
      console.error("Error deleting source concept for merge:", deleteError)
      return false // Potentially rollback
    }

    return true
  }

  async getConceptStats(): Promise<{
    totalConcepts: number
    byType: Record<string, number>
    topConcepts: Array<{ name: string; frequency: number }>
    averageFrequency: number
  }> {
    const concepts = await this.findAll()
    if (concepts.length === 0) {
      return { totalConcepts: 0, byType: {}, topConcepts: [], averageFrequency: 0 }
    }

    const byType: Record<string, number> = {}
    let totalFrequency = 0

    concepts.forEach((concept) => {
      byType[concept.type] = (byType[concept.type] || 0) + 1
      totalFrequency += concept.frequency
    })

    const topConcepts = concepts.slice(0, 10).map((c) => ({ name: c.name, frequency: c.frequency }))

    return {
      totalConcepts: concepts.length,
      byType,
      topConcepts,
      averageFrequency: totalFrequency / concepts.length,
    }
  }
}

export const conceptRepository = new ConceptRepository()
