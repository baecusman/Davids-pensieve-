import { browserDatabase } from "../browser-database"
import type { ContentEntity, AnalysisEntity, ConceptEntity, RelationshipEntity } from "../schema"

export class ContentRepository {
  private db = browserDatabase

  async createContent(data: {
    title: string
    url: string
    content: string
    source: string
  }): Promise<string> {
    // Generate content hash for deduplication
    const hash = this.generateContentHash(data.content)

    // Check for duplicates
    const existing = this.findByHash(hash)
    if (existing) {
      console.log("Content already exists:", existing.title)
      return existing.id
    }

    const contentId = this.db.insert<ContentEntity>("content", {
      id: "",
      title: data.title,
      url: data.url,
      content: data.content,
      source: data.source,
      hash,
      createdAt: "",
      updatedAt: "",
    })

    return contentId
  }

  async createAnalysis(data: {
    contentId: string
    summary: AnalysisEntity["summary"]
    entities: Array<{ name: string; type: ConceptEntity["type"] }>
    relationships: Array<{
      from: string
      to: string
      type: RelationshipEntity["type"]
    }>
    tags: string[]
    priority: AnalysisEntity["priority"]
    fullContent?: string
    confidence?: number
  }): Promise<string> {
    // Create or update concepts
    const conceptEntities = await this.upsertConcepts(data.entities)

    // Create analysis
    const analysisId = this.db.insert<AnalysisEntity>("analysis", {
      id: "",
      contentId: data.contentId,
      summary: data.summary,
      entities: conceptEntities,
      relationships: [], // Will be populated below
      tags: data.tags,
      priority: data.priority,
      fullContent: data.fullContent,
      confidence: data.confidence || 0.8,
      createdAt: "",
    })

    // Create relationships
    const relationships = await this.createRelationships(data.relationships, conceptEntities, data.contentId)

    // Update analysis with relationships
    this.db.update<AnalysisEntity>("analysis", analysisId, {
      relationships,
    })

    return analysisId
  }

  private async upsertConcepts(
    entities: Array<{ name: string; type: ConceptEntity["type"] }>,
  ): Promise<ConceptEntity[]> {
    const conceptEntities: ConceptEntity[] = []

    for (const entity of entities) {
      // Try to find existing concept
      const existing = this.db.findByIndex<ConceptEntity>("concepts", "name", entity.name)[0]

      if (existing) {
        // Update frequency
        this.db.update<ConceptEntity>("concepts", existing.id, {
          frequency: existing.frequency + 1,
          updatedAt: new Date().toISOString(),
        })
        conceptEntities.push({ ...existing, frequency: existing.frequency + 1 })
      } else {
        // Create new concept
        const conceptId = this.db.insert<ConceptEntity>("concepts", {
          id: "",
          name: entity.name,
          type: entity.type,
          frequency: 1,
          createdAt: "",
          updatedAt: "",
        })

        const newConcept = this.db.findById<ConceptEntity>("concepts", conceptId)!
        conceptEntities.push(newConcept)
      }
    }

    return conceptEntities
  }

  private async createRelationships(
    relationships: Array<{ from: string; to: string; type: RelationshipEntity["type"] }>,
    concepts: ConceptEntity[],
    contentId: string,
  ): Promise<RelationshipEntity[]> {
    const relationshipEntities: RelationshipEntity[] = []

    for (const rel of relationships) {
      const fromConcept = concepts.find((c) => c.name === rel.from)
      const toConcept = concepts.find((c) => c.name === rel.to)

      if (fromConcept && toConcept) {
        const relationshipId = this.db.insert<RelationshipEntity>("relationships", {
          id: "",
          fromConceptId: fromConcept.id,
          toConceptId: toConcept.id,
          type: rel.type,
          strength: 0.7, // Default strength
          contentId,
          createdAt: "",
        })

        const newRelationship = this.db.findById<RelationshipEntity>("relationships", relationshipId)!
        relationshipEntities.push(newRelationship)
      }
    }

    return relationshipEntities
  }

  findByHash(hash: string): ContentEntity | null {
    return this.db.findByIndex<ContentEntity>("content", "hash", hash)[0] || null
  }

  findAll(): ContentEntity[] {
    return this.db.findAll<ContentEntity>("content")
  }

  findById(id: string): ContentEntity | null {
    return this.db.findById<ContentEntity>("content", id)
  }

  findBySource(source: string): ContentEntity[] {
    return this.db.findByIndex<ContentEntity>("content", "source", source)
  }

  findRecent(limit = 10): ContentEntity[] {
    return this.db.findAll<ContentEntity>("content", {
      orderBy: { field: "createdAt", direction: "desc" },
      limit,
    })
  }

  findByTimeframe(timeframe: "weekly" | "monthly" | "quarterly"): ContentEntity[] {
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

    return this.db
      .findAll<ContentEntity>("content", {
        orderBy: { field: "createdAt", direction: "desc" },
      })
      .filter((content) => new Date(content.createdAt) >= cutoffDate)
  }

  searchContent(query: string): ContentEntity[] {
    return this.db.search<ContentEntity>("content", query, ["title", "content", "url"])
  }

  getContentWithAnalysis(contentId: string): {
    content: ContentEntity | null
    analysis: AnalysisEntity | null
  } {
    const content = this.findById(contentId)
    const analysis = this.db.findByIndex<AnalysisEntity>("analysis", "contentId", contentId)[0] || null

    return { content, analysis }
  }

  getAllWithAnalysis(): Array<{
    content: ContentEntity
    analysis: AnalysisEntity
  }> {
    const contents = this.db.findAll<ContentEntity>("content")
    const results: Array<{ content: ContentEntity; analysis: AnalysisEntity }> = []

    contents.forEach((content) => {
      const analysis = this.db.findByIndex<AnalysisEntity>("analysis", "contentId", content.id)[0]
      if (analysis) {
        results.push({ content, analysis })
      }
    })

    return results.sort((a, b) => new Date(b.content.createdAt).getTime() - new Date(a.content.createdAt).getTime())
  }

  deleteContent(id: string): boolean {
    // Delete related analysis
    const analyses = this.db.findByIndex<AnalysisEntity>("analysis", "contentId", id)
    analyses.forEach((analysis) => {
      this.db.delete("analysis", analysis.id)
    })

    // Delete related relationships
    const relationships = this.db.findByIndex<RelationshipEntity>("relationships", "contentId", id)
    relationships.forEach((rel) => {
      this.db.delete("relationships", rel.id)
    })

    // Delete content
    return this.db.delete("content", id)
  }

  getStats(): {
    totalContent: number
    bySource: Record<string, number>
    byPriority: Record<string, number>
    conceptCount: number
    relationshipCount: number
  } {
    const contents = this.db.findAll<ContentEntity>("content")
    const analyses = this.db.findAll<AnalysisEntity>("analysis")
    const concepts = this.db.findAll<ConceptEntity>("concepts")
    const relationships = this.db.findAll<RelationshipEntity>("relationships")

    const bySource: Record<string, number> = {}
    const byPriority: Record<string, number> = {}

    contents.forEach((content) => {
      bySource[content.source] = (bySource[content.source] || 0) + 1
    })

    analyses.forEach((analysis) => {
      byPriority[analysis.priority] = (byPriority[analysis.priority] || 0) + 1
    })

    return {
      totalContent: contents.length,
      bySource,
      byPriority,
      conceptCount: concepts.length,
      relationshipCount: relationships.length,
    }
  }

  private generateContentHash(content: string): string {
    // Simple hash for browser environment
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
}

export const contentRepository = new ContentRepository()
