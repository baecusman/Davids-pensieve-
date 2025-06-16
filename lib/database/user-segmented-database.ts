import { browserDatabase } from "./browser-database"
import { authManager } from "../auth/auth-manager"
import type { ContentEntity, AnalysisEntity, ConceptEntity, RelationshipEntity } from "./schema"

// Extended schema with user context
interface UserContentEntity extends ContentEntity {
  userId: string
}

interface UserAnalysisEntity extends AnalysisEntity {
  userId: string
}

interface UserConceptEntity extends ConceptEntity {
  userId: string
}

interface UserRelationshipEntity extends RelationshipEntity {
  userId: string
}

class UserSegmentedDatabase {
  private static instance: UserSegmentedDatabase
  private db = browserDatabase

  static getInstance(): UserSegmentedDatabase {
    if (!UserSegmentedDatabase.instance) {
      UserSegmentedDatabase.instance = new UserSegmentedDatabase()
    }
    return UserSegmentedDatabase.instance
  }

  private getCurrentUserId(): string {
    const userId = authManager.getCurrentUserId()
    if (!userId) {
      throw new Error("User not authenticated")
    }
    return userId
  }

  // Content operations with user context
  async createContent(data: {
    title: string
    url: string
    content: string
    source: string
  }): Promise<string> {
    const userId = this.getCurrentUserId()

    // Check for duplicates within user's data
    const userContent = this.getUserContent()
    const normalizedUrl = this.normalizeUrl(data.url)
    const existing = userContent.find((c) => this.normalizeUrl(c.url) === normalizedUrl)

    if (existing) {
      console.log("Content already exists for user:", existing.title)
      return existing.id
    }

    const hash = this.generateContentHash(data.content)
    const contentId = this.db.insert<UserContentEntity>("content", {
      id: "",
      userId,
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
    const userId = this.getCurrentUserId()

    // Create or update user-specific concepts
    const conceptEntities = await this.upsertUserConcepts(data.entities, userId)

    // Create analysis
    const analysisId = this.db.insert<UserAnalysisEntity>("analysis", {
      id: "",
      userId,
      contentId: data.contentId,
      summary: data.summary,
      entities: conceptEntities,
      relationships: [],
      tags: data.tags,
      priority: data.priority,
      fullContent: data.fullContent,
      confidence: data.confidence || 0.8,
      createdAt: "",
    })

    // Create user-specific relationships
    const relationships = await this.createUserRelationships(
      data.relationships,
      conceptEntities,
      data.contentId,
      userId,
    )

    // Update analysis with relationships
    this.db.update<UserAnalysisEntity>("analysis", analysisId, {
      relationships,
    })

    return analysisId
  }

  private async upsertUserConcepts(
    entities: Array<{ name: string; type: ConceptEntity["type"] }>,
    userId: string,
  ): Promise<ConceptEntity[]> {
    const conceptEntities: ConceptEntity[] = []

    for (const entity of entities) {
      // Find existing concept for this user
      const userConcepts = this.getUserConcepts()
      const existing = userConcepts.find((c) => c.name === entity.name && c.type === entity.type)

      if (existing) {
        // Update frequency
        this.db.update<UserConceptEntity>("concepts", existing.id, {
          frequency: existing.frequency + 1,
          updatedAt: new Date().toISOString(),
        })
        conceptEntities.push({ ...existing, frequency: existing.frequency + 1 })
      } else {
        // Create new concept for user
        const conceptId = this.db.insert<UserConceptEntity>("concepts", {
          id: "",
          userId,
          name: entity.name,
          type: entity.type,
          frequency: 1,
          createdAt: "",
          updatedAt: "",
        })

        const newConcept = this.db.findById<UserConceptEntity>("concepts", conceptId)!
        conceptEntities.push(newConcept)
      }
    }

    return conceptEntities
  }

  private async createUserRelationships(
    relationships: Array<{ from: string; to: string; type: RelationshipEntity["type"] }>,
    concepts: ConceptEntity[],
    contentId: string,
    userId: string,
  ): Promise<RelationshipEntity[]> {
    const relationshipEntities: RelationshipEntity[] = []

    for (const rel of relationships) {
      const fromConcept = concepts.find((c) => c.name === rel.from)
      const toConcept = concepts.find((c) => c.name === rel.to)

      if (fromConcept && toConcept) {
        const relationshipId = this.db.insert<UserRelationshipEntity>("relationships", {
          id: "",
          userId,
          fromConceptId: fromConcept.id,
          toConceptId: toConcept.id,
          type: rel.type,
          strength: 0.7,
          contentId,
          createdAt: "",
        })

        const newRelationship = this.db.findById<UserRelationshipEntity>("relationships", relationshipId)!
        relationshipEntities.push(newRelationship)
      }
    }

    return relationshipEntities
  }

  // User-specific data retrieval
  getUserContent(): UserContentEntity[] {
    const userId = this.getCurrentUserId()
    return this.db.findByIndex<UserContentEntity>("content", "userId", userId)
  }

  getUserAnalyses(): UserAnalysisEntity[] {
    const userId = this.getCurrentUserId()
    return this.db.findByIndex<UserAnalysisEntity>("analysis", "userId", userId)
  }

  getUserConcepts(): UserConceptEntity[] {
    const userId = this.getCurrentUserId()
    return this.db.findByIndex<UserConceptEntity>("concepts", "userId", userId)
  }

  getUserRelationships(): UserRelationshipEntity[] {
    const userId = this.getCurrentUserId()
    return this.db.findByIndex<UserRelationshipEntity>("relationships", "userId", userId)
  }

  getUserContentWithAnalysis(): Array<{
    content: UserContentEntity
    analysis: UserAnalysisEntity
  }> {
    const userContent = this.getUserContent()
    const results: Array<{ content: UserContentEntity; analysis: UserAnalysisEntity }> = []

    userContent.forEach((content) => {
      const analysis = this.db.findByIndex<UserAnalysisEntity>("analysis", "contentId", content.id)[0]
      if (analysis && analysis.userId === content.userId) {
        results.push({ content, analysis })
      }
    })

    return results.sort((a, b) => new Date(b.content.createdAt).getTime() - new Date(a.content.createdAt).getTime())
  }

  getUserConceptGraph(minFrequency = 1): {
    nodes: Array<UserConceptEntity & { density: number }>
    edges: Array<UserRelationshipEntity & { weight: number }>
  } {
    const concepts = this.getUserConcepts().filter((c) => c.frequency >= minFrequency)
    const conceptIds = new Set(concepts.map((c) => c.id))

    const maxFrequency = Math.max(...concepts.map((c) => c.frequency), 1)
    const nodes = concepts.map((concept) => ({
      ...concept,
      density: Math.min(100, (concept.frequency / maxFrequency) * 100),
    }))

    const relationships = this.getUserRelationships()
    const edges = relationships
      .filter((rel) => conceptIds.has(rel.fromConceptId) && conceptIds.has(rel.toConceptId))
      .map((rel) => ({
        ...rel,
        weight: rel.strength,
      }))

    return { nodes, edges }
  }

  // User-specific search
  searchUserContent(query: string): UserContentEntity[] {
    const userContent = this.getUserContent()
    const lowerQuery = query.toLowerCase()

    return userContent.filter(
      (content) =>
        content.title.toLowerCase().includes(lowerQuery) ||
        content.content.toLowerCase().includes(lowerQuery) ||
        content.url.toLowerCase().includes(lowerQuery),
    )
  }

  // User statistics
  getUserStats(): {
    totalContent: number
    totalConcepts: number
    totalRelationships: number
    bySource: Record<string, number>
    byPriority: Record<string, number>
    recentActivity: Array<{ date: string; count: number }>
  } {
    const content = this.getUserContent()
    const concepts = this.getUserConcepts()
    const relationships = this.getUserRelationships()
    const analyses = this.getUserAnalyses()

    const bySource: Record<string, number> = {}
    const byPriority: Record<string, number> = {}

    content.forEach((item) => {
      bySource[item.source] = (bySource[item.source] || 0) + 1
    })

    analyses.forEach((analysis) => {
      byPriority[analysis.priority] = (byPriority[analysis.priority] || 0) + 1
    })

    // Calculate recent activity (last 7 days)
    const recentActivity: Array<{ date: string; count: number }> = []
    const now = new Date()

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split("T")[0]
      const count = content.filter((c) => c.createdAt.startsWith(dateStr)).length

      recentActivity.push({ date: dateStr, count })
    }

    return {
      totalContent: content.length,
      totalConcepts: concepts.length,
      totalRelationships: relationships.length,
      bySource,
      byPriority,
      recentActivity,
    }
  }

  // Admin functions - cross-user operations
  getAllUsersStats(): Record<string, any> {
    const allUsers = authManager.getAllUsers()
    const stats: Record<string, any> = {}

    allUsers.forEach((user) => {
      const userContent = this.db.findByIndex<UserContentEntity>("content", "userId", user.id)
      const userConcepts = this.db.findByIndex<UserConceptEntity>("concepts", "userId", user.id)

      stats[user.username] = {
        userId: user.id,
        displayName: user.displayName,
        contentCount: userContent.length,
        conceptCount: userConcepts.length,
        lastLogin: user.lastLogin,
      }
    })

    return stats
  }

  // Utility methods
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source"]
      trackingParams.forEach((param) => urlObj.searchParams.delete(param))
      return urlObj.toString().replace(/\/$/, "").split("#")[0]
    } catch {
      return url.trim()
    }
  }

  private generateContentHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  // Data migration for existing users
  migrateExistingData(): { success: boolean; migrated: number } {
    try {
      const adminUser = authManager.getAllUsers().find((u) => u.username === "admin")
      if (!adminUser) {
        return { success: false, migrated: 0 }
      }

      // Find content without userId
      const allContent = this.db.findAll<any>("content")
      const unmigrated = allContent.filter((c) => !c.userId)

      let migrated = 0
      unmigrated.forEach((content) => {
        this.db.update("content", content.id, { userId: adminUser.id })
        migrated++
      })

      // Migrate other entities similarly
      const allAnalyses = this.db.findAll<any>("analysis")
      allAnalyses
        .filter((a) => !a.userId)
        .forEach((analysis) => {
          this.db.update("analysis", analysis.id, { userId: adminUser.id })
          migrated++
        })

      const allConcepts = this.db.findAll<any>("concepts")
      allConcepts
        .filter((c) => !c.userId)
        .forEach((concept) => {
          this.db.update("concepts", concept.id, { userId: adminUser.id })
          migrated++
        })

      const allRelationships = this.db.findAll<any>("relationships")
      allRelationships
        .filter((r) => !r.userId)
        .forEach((relationship) => {
          this.db.update("relationships", relationship.id, { userId: adminUser.id })
          migrated++
        })

      console.log(`Migrated ${migrated} records to admin user`)
      return { success: true, migrated }
    } catch (error) {
      console.error("Migration failed:", error)
      return { success: false, migrated: 0 }
    }
  }
}

export const userSegmentedDatabase = UserSegmentedDatabase.getInstance()
