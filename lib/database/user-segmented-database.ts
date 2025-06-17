import { BrowserDatabase } from "./browser-database"
import { simpleAuth } from "../auth/simple-auth"
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

interface UserContent {
  content: any
  analysis: any
}

class UserSegmentedDatabase {
  private static instance: UserSegmentedDatabase
  private database: BrowserDatabase

  static getInstance(): UserSegmentedDatabase {
    if (!UserSegmentedDatabase.instance) {
      UserSegmentedDatabase.instance = new UserSegmentedDatabase()
    }
    return UserSegmentedDatabase.instance
  }

  constructor() {
    this.database = BrowserDatabase.getInstance()
  }

  private getCurrentUserId(): string {
    const userId = simpleAuth.getCurrentUser()?.id
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
    const contentId = this.database.storeContent({
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
    const analysisId = this.database.storeAnalysis({
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
    this.database.updateAnalysis(analysisId, {
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
        this.database.updateConcept(existing.id, {
          frequency: existing.frequency + 1,
          updatedAt: new Date().toISOString(),
        })
        conceptEntities.push({ ...existing, frequency: existing.frequency + 1 })
      } else {
        // Create new concept for user
        const conceptId = this.database.storeConcept({
          id: "",
          userId,
          name: entity.name,
          type: entity.type,
          frequency: 1,
          createdAt: "",
          updatedAt: "",
        })

        const newConcept = this.database.findConceptById(conceptId)!
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
        const relationshipId = this.database.storeRelationship({
          id: "",
          userId,
          fromConceptId: fromConcept.id,
          toConceptId: toConcept.id,
          type: rel.type,
          strength: 0.7,
          contentId,
          createdAt: "",
        })

        const newRelationship = this.database.findRelationshipById(relationshipId)!
        relationshipEntities.push(newRelationship)
      }
    }

    return relationshipEntities
  }

  // User-specific data retrieval
  getUserContent(): UserContentEntity[] {
    const userId = this.getCurrentUserId()
    return this.database.getUserContent(userId)
  }

  getUserAnalyses(): UserAnalysisEntity[] {
    const userId = this.getCurrentUserId()
    return this.database.getUserAnalyses(userId)
  }

  getUserConcepts(): UserConceptEntity[] {
    const userId = this.getCurrentUserId()
    return this.database.getUserConcepts(userId)
  }

  getUserRelationships(): UserRelationshipEntity[] {
    const userId = this.getCurrentUserId()
    return this.database.getUserRelationships(userId)
  }

  // Get content with analysis for a specific user (or current user if no userId provided)
  getUserContentWithAnalysis(userId?: string): UserContent[] {
    try {
      const targetUserId = userId || simpleAuth.getCurrentUser()?.id

      if (!targetUserId) {
        console.warn("No user ID provided and no current user found")
        return []
      }

      console.log(`Getting content for user: ${targetUserId}`)

      // Get all content for the user
      const userContent = this.database.getUserContent(targetUserId)
      console.log(`Found ${userContent.length} content items for user ${targetUserId}`)

      // Get all analyses for the user
      const userAnalyses = this.database.getUserAnalyses(targetUserId)
      console.log(`Found ${userAnalyses.length} analyses for user ${targetUserId}`)

      // Combine content with their analyses
      const contentWithAnalysis: UserContent[] = userContent.map((content) => {
        const analysis = userAnalyses.find((a) => a.contentId === content.id)
        return {
          content,
          analysis: analysis || null,
        }
      })

      console.log(`Combined ${contentWithAnalysis.length} content items with analyses`)
      return contentWithAnalysis
    } catch (error) {
      console.error("Error getting user content with analysis:", error)
      return []
    }
  }

  // Get content for current user
  getCurrentUserContent(): UserContent[] {
    const currentUser = simpleAuth.getCurrentUser()
    if (!currentUser) {
      console.warn("No current user found")
      return []
    }

    return this.getUserContentWithAnalysis(currentUser.id)
  }

  // Store content for current user
  storeUserContent(content: any): boolean {
    try {
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        console.error("No current user found")
        return false
      }

      // Add user ID to content
      const userContent = {
        ...content,
        userId: currentUser.id,
        createdAt: content.createdAt || new Date().toISOString(),
      }

      return this.database.storeContent(userContent)
    } catch (error) {
      console.error("Error storing user content:", error)
      return false
    }
  }

  // Store analysis for current user
  storeUserAnalysis(analysis: any): boolean {
    try {
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        console.error("No current user found")
        return false
      }

      // Add user ID to analysis
      const userAnalysis = {
        ...analysis,
        userId: currentUser.id,
        createdAt: analysis.createdAt || new Date().toISOString(),
      }

      return this.database.storeAnalysis(userAnalysis)
    } catch (error) {
      console.error("Error storing user analysis:", error)
      return false
    }
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

  // Get user statistics
  getUserStats(userId?: string): any {
    try {
      const targetUserId = userId || simpleAuth.getCurrentUser()?.id

      if (!targetUserId) {
        return {
          totalContent: 0,
          totalAnalyses: 0,
          recentContent: 0,
        }
      }

      const userContent = this.database.getUserContent(targetUserId)
      const userAnalyses = this.database.getUserAnalyses(targetUserId)

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const recentContent = userContent.filter((c) => new Date(c.createdAt) > weekAgo)

      return {
        totalContent: userContent.length,
        totalAnalyses: userAnalyses.length,
        recentContent: recentContent.length,
        userId: targetUserId,
      }
    } catch (error) {
      console.error("Error getting user stats:", error)
      return {
        totalContent: 0,
        totalAnalyses: 0,
        recentContent: 0,
      }
    }
  }

  // Admin functions - cross-user operations
  getAllUsersStats(): Record<string, any> {
    const allUsers = simpleAuth.getAllUsers()
    const stats: Record<string, any> = {}

    allUsers.forEach((user) => {
      const userContent = this.database.getUserContent(user.id)
      const userConcepts = this.database.getUserConcepts(user.id)

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
      const adminUser = simpleAuth.getAllUsers().find((u) => u.username === "admin")
      if (!adminUser) {
        return { success: false, migrated: 0 }
      }

      // Find content without userId
      const allContent = this.database.findAllContent()
      const unmigrated = allContent.filter((c) => !c.userId)

      let migrated = 0
      unmigrated.forEach((content) => {
        this.database.updateContent(content.id, { userId: adminUser.id })
        migrated++
      })

      // Migrate other entities similarly
      const allAnalyses = this.database.findAllAnalyses()
      allAnalyses
        .filter((a) => !a.userId)
        .forEach((analysis) => {
          this.database.updateAnalysis(analysis.id, { userId: adminUser.id })
          migrated++
        })

      const allConcepts = this.database.findAllConcepts()
      allConcepts
        .filter((c) => !c.userId)
        .forEach((concept) => {
          this.database.updateConcept(concept.id, { userId: adminUser.id })
          migrated++
        })

      const allRelationships = this.database.findAllRelationships()
      allRelationships
        .filter((r) => !r.userId)
        .forEach((relationship) => {
          this.database.updateRelationship(relationship.id, { userId: adminUser.id })
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
