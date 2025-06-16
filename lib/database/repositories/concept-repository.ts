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

  getConceptGraph(minFrequency = 1): {
    nodes: Array<ConceptEntity & { density: number }>
    edges: Array<RelationshipEntity & { weight: number }>
  } {
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
  }

  getRelatedConcepts(conceptId: string, limit = 10): ConceptEntity[] {
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
  }

  getTrendingConcepts(
    timeframe: "weekly" | "monthly" | "quarterly",
    limit = 10,
  ): Array<{
    concept: ConceptEntity
    growth: number
    recentMentions: number
  }> {
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
  }

  updateConceptDescription(id: string, description: string): boolean {
    return this.db.update<ConceptEntity>("concepts", id, { description })
  }

  mergeConceptByConcepts(sourceId: string, targetId: string): boolean {
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
  }

  getConceptStats(): {
    totalConcepts: number
    byType: Record<string, number>
    topConcepts: Array<{ name: string; frequency: number }>
    averageFrequency: number
  } {
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
  }
}

export const conceptRepository = new ConceptRepository()
