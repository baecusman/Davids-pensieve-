import { browserDatabase } from "../browser-database"
import type { ConceptEntity, RelationshipEntity, ContentEntity, AnalysisEntity } from "../schema"

export class ConceptRepository {
  private db = browserDatabase

  findById(id: string): ConceptEntity | null {
    return this.db.findById<ConceptEntity>("concepts", id)
  }

  findByName(name: string): ConceptEntity | null {
    return this.db.findByIndex<ConceptEntity>("concepts", "name", name)[0] || null
  }

  findByType(type: ConceptEntity["type"]): ConceptEntity[] {
    return this.db.findByIndex<ConceptEntity>("concepts", "type", type)
  }

  findAll(): ConceptEntity[] {
    return this.db.findAll<ConceptEntity>("concepts", {
      orderBy: { field: "frequency", direction: "desc" },
    })
  }

  searchConcepts(query: string): ConceptEntity[] {
    return this.db.search<ConceptEntity>("concepts", query, ["name", "description"])
  }

  // Fixed method: Create or update concept
  async createOrUpdateConcept(data: {
    name: string
    type: string
    description?: string
  }): Promise<string> {
    try {
      // Check if concept already exists
      const existing = this.findByName(data.name)

      if (existing) {
        // Update frequency and return existing ID
        this.db.update<ConceptEntity>("concepts", existing.id, {
          frequency: existing.frequency + 1,
          description: data.description || existing.description,
        })
        return existing.id
      }

      // Create new concept using insert method
      const newConcept: ConceptEntity = {
        id: `concept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        type: data.type as any,
        description: data.description || "",
        frequency: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const conceptId = this.db.insert("concepts", newConcept)
      return conceptId
    } catch (error) {
      console.error("Error creating/updating concept:", error)
      throw error
    }
  }

  // Fixed method: Find or create concept
  async findOrCreateConcept(name: string, type: string): Promise<string> {
    const existing = this.findByName(name)
    if (existing) {
      return existing.id
    }

    return this.createOrUpdateConcept({
      name,
      type,
      description: `Auto-generated concept: ${name}`,
    })
  }

  // Fixed method: Link concept to content
  async linkConceptToContent(conceptId: string, contentId: string): Promise<void> {
    try {
      // For now, we'll track this in a simple way by updating concept metadata
      const concept = this.findById(conceptId)
      if (concept) {
        // Since the schema doesn't have linkedContent, we'll track this differently
        // We can use the existing relationship system or add it to description
        const updatedDescription = concept.description
          ? `${concept.description} [Linked to content: ${contentId}]`
          : `Linked to content: ${contentId}`

        this.db.update<ConceptEntity>("concepts", conceptId, {
          description: updatedDescription,
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error("Error linking concept to content:", error)
      // Don't throw - this is not critical
    }
  }

  // Fixed method: Create relationship
  async createRelationship(data: {
    fromConceptId: string
    toConceptId: string
    type: string
    weight: number
    contentId: string
  }): Promise<string> {
    try {
      // Check if relationship already exists
      const existing = this.db
        .findAll<RelationshipEntity>("relationships")
        .find(
          (rel) =>
            rel.fromConceptId === data.fromConceptId && rel.toConceptId === data.toConceptId && rel.type === data.type,
        )

      if (existing) {
        // Update existing relationship strength
        this.db.update<RelationshipEntity>("relationships", existing.id, {
          strength: Math.min(1, existing.strength + 0.1),
        })
        return existing.id
      }

      // Create new relationship using insert method
      const newRelationship: RelationshipEntity = {
        id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromConceptId: data.fromConceptId,
        toConceptId: data.toConceptId,
        type: data.type as any,
        strength: data.weight,
        contentId: data.contentId,
        createdAt: new Date().toISOString(),
      }

      const relationshipId = this.db.insert("relationships", newRelationship)
      return relationshipId
    } catch (error) {
      console.error("Error creating relationship:", error)
      // Don't throw - this is not critical for main functionality
      return ""
    }
  }

  // Fixed method: Get article IDs for concept
  getArticleIdsForConcept(conceptId: string): string[] {
    try {
      const concept = this.findById(conceptId)
      if (!concept) return []

      // Get all analyses and find ones that mention this concept
      const analyses = this.db.findAll<AnalysisEntity>("analysis")
      const articleIds: string[] = []

      analyses.forEach((analysis) => {
        // Check entities
        const hasEntity = analysis.entities.some((entity) => entity.name.toLowerCase() === concept.name.toLowerCase())

        // Check tags
        const hasTag = analysis.tags.some(
          (tag) =>
            tag.toLowerCase() === concept.name.toLowerCase() ||
            tag.toLowerCase().includes(concept.name.toLowerCase()) ||
            concept.name.toLowerCase().includes(tag.toLowerCase()),
        )

        if (hasEntity || hasTag) {
          articleIds.push(analysis.contentId)
        }
      })

      const uniqueIds = [...new Set(articleIds)]
      console.log(`Concept ${concept.name} linked to ${uniqueIds.length} articles:`, uniqueIds)
      return uniqueIds
    } catch (error) {
      console.error("Error getting article IDs for concept:", conceptId, error)
      return []
    }
  }

  getConceptGraph(minFrequency = 1): {
    nodes: Array<ConceptEntity & { density: number }>
    edges: Array<RelationshipEntity & { weight: number }>
  } {
    try {
      // Get concepts above minimum frequency
      const concepts = this.findAll().filter((c) => c.frequency >= minFrequency)
      const conceptIds = new Set(concepts.map((c) => c.id))

      // Calculate density (normalized frequency)
      const maxFrequency = Math.max(...concepts.map((c) => c.frequency), 1)
      const nodes = concepts.map((concept) => ({
        ...concept,
        density: Math.min(100, (concept.frequency / maxFrequency) * 100),
      }))

      // Get relationships between these concepts
      const allRelationships = this.db.findAll<RelationshipEntity>("relationships")
      const edges = allRelationships
        .filter((rel) => conceptIds.has(rel.fromConceptId) && conceptIds.has(rel.toConceptId))
        .map((rel) => ({
          ...rel,
          weight: rel.strength,
        }))

      return { nodes, edges }
    } catch (error) {
      console.error("Error getting concept graph:", error)
      return { nodes: [], edges: [] }
    }
  }

  getRelatedConcepts(conceptId: string, limit = 10): ConceptEntity[] {
    try {
      // Find all relationships involving this concept
      const outgoingRels = this.db.findByIndex<RelationshipEntity>("relationships", "fromConceptId", conceptId)
      const incomingRels = this.db.findByIndex<RelationshipEntity>("relationships", "toConceptId", conceptId)

      const relatedIds = new Set<string>()
      outgoingRels.forEach((rel) => relatedIds.add(rel.toConceptId))
      incomingRels.forEach((rel) => relatedIds.add(rel.fromConceptId))

      const relatedConcepts = Array.from(relatedIds)
        .map((id) => this.findById(id))
        .filter(Boolean) as ConceptEntity[]

      return relatedConcepts.sort((a, b) => b.frequency - a.frequency).slice(0, limit)
    } catch (error) {
      console.error("Error getting related concepts:", error)
      return []
    }
  }

  getConceptDetails(conceptId: string): {
    concept: ConceptEntity | null
    relatedConcepts: ConceptEntity[]
    articles: Array<{ content: ContentEntity; analysis: AnalysisEntity }>
    relationshipStats: {
      incoming: number
      outgoing: number
      types: Record<string, number>
    }
  } {
    try {
      const concept = this.findById(conceptId)
      if (!concept) {
        return {
          concept: null,
          relatedConcepts: [],
          articles: [],
          relationshipStats: { incoming: 0, outgoing: 0, types: {} },
        }
      }

      const relatedConcepts = this.getRelatedConcepts(conceptId, 5)

      // Find articles that mention this concept
      const analyses = this.db.findAll<AnalysisEntity>("analysis")
      const relevantAnalyses = analyses.filter(
        (analysis) =>
          analysis.entities.some((entity) => entity.name === concept.name) || analysis.tags.includes(concept.name),
      )

      const articles = relevantAnalyses
        .map((analysis) => {
          const content = this.db.findById<ContentEntity>("content", analysis.contentId)
          return content ? { content, analysis } : null
        })
        .filter(Boolean) as Array<{ content: ContentEntity; analysis: AnalysisEntity }>

      // Calculate relationship stats
      const outgoingRels = this.db.findByIndex<RelationshipEntity>("relationships", "fromConceptId", conceptId)
      const incomingRels = this.db.findByIndex<RelationshipEntity>("relationships", "toConceptId", conceptId)

      const types: Record<string, number> = {}
      const allRels = [...outgoingRels, ...incomingRels]
      allRels.forEach((rel) => {
        types[rel.type] = (types[rel.type] || 0) + 1
      })

      return {
        concept,
        relatedConcepts,
        articles,
        relationshipStats: {
          incoming: incomingRels.length,
          outgoing: outgoingRels.length,
          types,
        },
      }
    } catch (error) {
      console.error("Error getting concept details:", error)
      return {
        concept: null,
        relatedConcepts: [],
        articles: [],
        relationshipStats: { incoming: 0, outgoing: 0, types: {} },
      }
    }
  }

  getTrendingConcepts(
    timeframe: "weekly" | "monthly" | "quarterly",
    limit = 10,
  ): Array<{
    concept: ConceptEntity
    growth: number
    recentMentions: number
  }> {
    try {
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

      // Get recent content
      const recentContent = this.db
        .findAll<ContentEntity>("content")
        .filter((content) => new Date(content.createdAt) >= cutoffDate)

      const recentContentIds = new Set(recentContent.map((c) => c.id))

      // Get recent analyses
      const recentAnalyses = this.db
        .findAll<AnalysisEntity>("analysis")
        .filter((analysis) => recentContentIds.has(analysis.contentId))

      // Count concept mentions in recent content
      const conceptCounts = new Map<string, number>()

      recentAnalyses.forEach((analysis) => {
        analysis.entities.forEach((entity) => {
          conceptCounts.set(entity.name, (conceptCounts.get(entity.name) || 0) + 1)
        })
        analysis.tags.forEach((tag) => {
          conceptCounts.set(tag, (conceptCounts.get(tag) || 0) + 1)
        })
      })

      // Calculate trending scores
      const trending = Array.from(conceptCounts.entries())
        .map(([name, recentMentions]) => {
          const concept = this.findByName(name)
          if (!concept) return null

          // Calculate growth rate (recent vs historical)
          const historicalRate = concept.frequency / Math.max(1, concept.frequency)
          const recentRate = recentMentions / Math.max(1, recentContent.length)
          const growth = recentRate / Math.max(0.01, historicalRate)

          return {
            concept,
            growth,
            recentMentions,
          }
        })
        .filter(Boolean) as Array<{
        concept: ConceptEntity
        growth: number
        recentMentions: number
      }>

      return trending.sort((a, b) => b.growth - a.growth).slice(0, limit)
    } catch (error) {
      console.error("Error getting trending concepts:", error)
      return []
    }
  }

  updateConceptDescription(id: string, description: string): boolean {
    return this.db.update<ConceptEntity>("concepts", id, { description })
  }

  mergeConceptByConcepts(sourceId: string, targetId: string): boolean {
    try {
      const sourceConcept = this.findById(sourceId)
      const targetConcept = this.findById(targetId)

      if (!sourceConcept || !targetConcept) return false

      // Update relationships to point to target concept
      const outgoingRels = this.db.findByIndex<RelationshipEntity>("relationships", "fromConceptId", sourceId)
      const incomingRels = this.db.findByIndex<RelationshipEntity>("relationships", "toConceptId", sourceId)

      outgoingRels.forEach((rel) => {
        this.db.update<RelationshipEntity>("relationships", rel.id, {
          fromConceptId: targetId,
        })
      })

      incomingRels.forEach((rel) => {
        this.db.update<RelationshipEntity>("relationships", rel.id, {
          toConceptId: targetId,
        })
      })

      // Update target concept frequency
      this.db.update<ConceptEntity>("concepts", targetId, {
        frequency: targetConcept.frequency + sourceConcept.frequency,
      })

      // Delete source concept
      this.db.delete("concepts", sourceId)

      return true
    } catch (error) {
      console.error("Error merging concepts:", error)
      return false
    }
  }

  getConceptStats(): {
    totalConcepts: number
    byType: Record<string, number>
    topConcepts: Array<{ name: string; frequency: number }>
    averageFrequency: number
  } {
    try {
      const concepts = this.findAll()

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
        averageFrequency: concepts.length > 0 ? totalFrequency / concepts.length : 0,
      }
    } catch (error) {
      console.error("Error getting concept stats:", error)
      return {
        totalConcepts: 0,
        byType: {},
        topConcepts: [],
        averageFrequency: 0,
      }
    }
  }
}

export const conceptRepository = new ConceptRepository()
