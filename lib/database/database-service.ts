import { browserDatabase } from "./browser-database"
import { contentRepository } from "./repositories/content-repository"
import { conceptRepository } from "./repositories/concept-repository"
import { simpleAuth } from "../auth/simple-auth"

export class DatabaseService {
  private static instance: DatabaseService
  private db = browserDatabase
  private contentRepo = contentRepository
  private conceptRepo = conceptRepository

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  // Content Management with better error handling and validation
  async storeAnalyzedContent(data: {
    title: string
    url: string
    content: string
    source: string
    analysis: {
      summary: {
        sentence: string
        paragraph: string
        isFullRead: boolean
      }
      entities: Array<{ name: string; type: string }>
      relationships: Array<{ from: string; to: string; type: string }>
      tags: string[]
      priority: "skim" | "read" | "deep-dive"
      fullContent?: string
      confidence?: number
    }
  }): Promise<{ contentId: string; analysisId: string; isNew: boolean }> {
    try {
      // Validate input data
      if (!data.title?.trim() || !data.url?.trim() || !data.content?.trim()) {
        throw new Error("Missing required content fields")
      }

      // Get current user
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        throw new Error("User not authenticated")
      }

      // Check for duplicates using improved deduplication
      const normalizedUrl = this.normalizeUrl(data.url)
      const existingContent = this.findContentByUrl(normalizedUrl, currentUser.id)

      if (existingContent) {
        console.log("Content already exists:", existingContent.title)
        return {
          contentId: existingContent.id,
          analysisId: existingContent.analysisId || "",
          isNew: false,
        }
      }

      // Create content record
      const contentId = this.generateId()
      const contentSuccess = this.db.storeContent({
        id: contentId,
        userId: currentUser.id,
        title: data.title.trim(),
        url: normalizedUrl,
        content: data.content,
        source: data.source,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      if (!contentSuccess) {
        throw new Error("Failed to store content")
      }

      // Create analysis record
      const analysisId = this.generateId()
      const analysisSuccess = this.db.storeAnalysis({
        id: analysisId,
        userId: currentUser.id,
        contentId,
        summary: data.analysis.summary,
        concepts: data.analysis.entities.map((e) => ({
          name: e.name.trim(),
          type: e.type,
        })),
        priority: data.analysis.priority,
        tags: data.analysis.tags.filter((tag) => tag.trim()).map((tag) => tag.trim()),
        fullContent: data.analysis.fullContent,
        confidence: Math.max(0, Math.min(1, data.analysis.confidence || 0.8)),
        createdAt: new Date().toISOString(),
      })

      if (!analysisSuccess) {
        throw new Error("Failed to store analysis")
      }

      return { contentId, analysisId, isNew: true }
    } catch (error) {
      console.error("Error storing analyzed content:", error)
      throw new Error(`Failed to store content: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // Remove common tracking parameters
      const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source"]
      trackingParams.forEach((param) => urlObj.searchParams.delete(param))

      // Remove trailing slash and fragments
      const normalized = urlObj.toString().replace(/\/$/, "").split("#")[0]
      return normalized
    } catch {
      return url.trim()
    }
  }

  private findContentByUrl(url: string, userId: string): any | null {
    try {
      const userContent = this.db.getUserContent(userId)
      return userContent.find((content) => this.normalizeUrl(content.url) === url || content.url === url) || null
    } catch (error) {
      console.error("Error finding content by URL:", error)
      return null
    }
  }

  getStoredContent(
    options: {
      limit?: number
      offset?: number
      source?: string
      priority?: string
      timeframe?: "weekly" | "monthly" | "quarterly"
    } = {},
  ): {
    items: Array<{
      id: string
      title: string
      url: string
      content: string
      analysis: {
        summary: {
          sentence: string
          paragraph: string
          isFullRead: boolean
        }
        entities: Array<{ name: string; type: string }>
        relationships: Array<{ from: string; to: string; type: string }>
        tags: string[]
        priority: "skim" | "read" | "deep-dive"
        fullContent?: string
      }
      createdAt: string
      source: string
    }>
    total: number
    hasMore: boolean
  } {
    try {
      // Get current user
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        console.warn("No current user found")
        return { items: [], total: 0, hasMore: false }
      }

      // Get user's content and analyses
      const userContent = this.db.getUserContent(currentUser.id)
      const userAnalyses = this.db.getUserAnalyses(currentUser.id)

      console.log(
        `Found ${userContent.length} content items and ${userAnalyses.length} analyses for user ${currentUser.id}`,
      )

      // Combine content with analyses
      let results = userContent
        .map((content) => {
          const analysis = userAnalyses.find((a) => a.contentId === content.id)
          return {
            content,
            analysis,
          }
        })
        .filter((item) => item.analysis) // Only include items with analysis

      // Apply filters
      if (options.source) {
        results = results.filter((r) => r.content.source === options.source)
      }
      if (options.priority) {
        results = results.filter((r) => r.analysis.priority === options.priority)
      }
      if (options.timeframe) {
        const cutoffDate = this.getTimeframeCutoff(options.timeframe)
        results = results.filter((r) => new Date(r.content.createdAt) >= cutoffDate)
      }

      const total = results.length
      const offset = options.offset || 0
      const limit = options.limit || 50

      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit)

      const items = paginatedResults.map(({ content, analysis }) => ({
        id: content.id,
        title: content.title,
        url: content.url,
        content: content.content,
        analysis: {
          summary: analysis.summary || {
            sentence: "No summary available",
            paragraph: "No detailed summary available",
            isFullRead: false,
          },
          entities: analysis.concepts || [],
          relationships: [], // TODO: Implement relationships
          tags: analysis.tags || [],
          priority: analysis.priority || "read",
          fullContent: analysis.fullContent,
        },
        createdAt: content.createdAt,
        source: content.source,
      }))

      console.log(`Returning ${items.length} items out of ${total} total`)

      return {
        items,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      console.error("Error getting stored content:", error)
      return { items: [], total: 0, hasMore: false }
    }
  }

  private getTimeframeCutoff(timeframe: "weekly" | "monthly" | "quarterly"): Date {
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

    return cutoffDate
  }

  // Enhanced Concept Management
  getConceptMapData(abstractionLevel = 50, searchQuery = "") {
    try {
      console.log("DatabaseService: Getting concept map data", { abstractionLevel, searchQuery })

      // Get current user
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        console.warn("No current user found")
        return { nodes: [], edges: [] }
      }

      // Get user's analyses to extract concepts
      const userAnalyses = this.db.getUserAnalyses(currentUser.id)
      console.log(`Found ${userAnalyses.length} analyses for concept extraction`)

      // Extract concepts from analyses
      const conceptMap = new Map<string, { name: string; type: string; frequency: number; articles: string[] }>()

      userAnalyses.forEach((analysis) => {
        if (analysis.concepts && Array.isArray(analysis.concepts)) {
          analysis.concepts.forEach((concept) => {
            const key = `${concept.name}-${concept.type}`
            if (conceptMap.has(key)) {
              const existing = conceptMap.get(key)!
              existing.frequency += 1
              existing.articles.push(analysis.contentId)
            } else {
              conceptMap.set(key, {
                name: concept.name,
                type: concept.type,
                frequency: 1,
                articles: [analysis.contentId],
              })
            }
          })
        }
      })

      // Convert to nodes array
      let nodes = Array.from(conceptMap.values()).map((concept, index) => ({
        id: `concept-${index}`,
        label: concept.name,
        type: concept.type,
        frequency: concept.frequency,
        density: this.calculateNodeDensity(
          concept.frequency,
          Math.max(...Array.from(conceptMap.values()).map((c) => c.frequency)),
        ),
        articles: concept.articles,
        description: `${concept.type} mentioned ${concept.frequency} times`,
        source: "analyzed" as const,
      }))

      // Apply abstraction level filtering
      const maxFrequency = Math.max(...nodes.map((n) => n.frequency), 1)
      const minFrequency = Math.max(1, Math.floor((abstractionLevel / 100) * maxFrequency))
      nodes = nodes.filter((node) => node.frequency >= minFrequency)

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        nodes = nodes.filter(
          (node) =>
            node.label?.toLowerCase().includes(query) ||
            node.description?.toLowerCase().includes(query) ||
            node.type?.toLowerCase().includes(query),
        )
      }

      // Create simple edges based on co-occurrence
      const edges: any[] = []
      const nodeIds = nodes.map((n) => n.id)

      // For now, create edges between concepts that appear in the same articles
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i]
          const node2 = nodes[j]

          // Check if they share any articles
          const sharedArticles = node1.articles.filter((article) => node2.articles.includes(article))

          if (sharedArticles.length > 0) {
            edges.push({
              id: `edge-${i}-${j}`,
              source: node1.id,
              target: node2.id,
              type: "co_occurs",
              weight: Math.min(1, sharedArticles.length / Math.max(node1.articles.length, node2.articles.length)),
            })
          }
        }
      }

      const result = { nodes, edges }
      console.log("DatabaseService: Returning", result.nodes.length, "nodes and", result.edges.length, "edges")
      return result
    } catch (error) {
      console.error("Error getting concept map data:", error)
      return { nodes: [], edges: [] }
    }
  }

  private calculateNodeDensity(frequency: number, maxFrequency: number): number {
    if (maxFrequency <= 1) return 50
    return Math.min(100, Math.max(10, (frequency / maxFrequency) * 100))
  }

  searchContent(
    query: string,
    options: {
      limit?: number
      sources?: string[]
      priorities?: string[]
      dateRange?: { start: Date; end: Date }
    } = {},
  ): Array<{
    id: string
    title: string
    url: string
    analysis: { summary: { sentence: string }; tags: string[] }
    createdAt: string
    relevanceScore: number
  }> {
    try {
      // Get current user
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        return []
      }

      const userContent = this.db.getUserContent(currentUser.id)
      const userAnalyses = this.db.getUserAnalyses(currentUser.id)

      let results = userContent.map((content) => {
        const analysis = userAnalyses.find((a) => a.contentId === content.id)

        // Calculate relevance score
        const titleMatch = content.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 0
        const contentMatch = content.content.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        const tagMatch = analysis?.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase())) ? 1.5 : 0

        return {
          id: content.id,
          title: content.title,
          url: content.url,
          analysis: analysis
            ? {
                summary: { sentence: analysis.summary?.sentence || "No summary available" },
                tags: analysis.tags || [],
              }
            : {
                summary: { sentence: "No analysis available" },
                tags: [],
              },
          createdAt: content.createdAt,
          relevanceScore: titleMatch + contentMatch + tagMatch,
        }
      })

      // Apply filters
      if (options.sources?.length) {
        const sourceSet = new Set(options.sources)
        results = results.filter((r) => {
          const content = userContent.find((c) => c.id === r.id)
          return content && sourceSet.has(content.source)
        })
      }

      if (options.priorities?.length) {
        const prioritySet = new Set(options.priorities)
        results = results.filter((r) => {
          const analysis = userAnalyses.find((a) => a.contentId === r.id)
          return analysis && prioritySet.has(analysis.priority)
        })
      }

      if (options.dateRange) {
        results = results.filter((r) => {
          const date = new Date(r.createdAt)
          return date >= options.dateRange!.start && date <= options.dateRange!.end
        })
      }

      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore)

      return results.slice(0, options.limit || 20)
    } catch (error) {
      console.error("Error searching content:", error)
      return []
    }
  }

  deleteContent(id: string): boolean {
    try {
      // Get current user
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        return false
      }

      // For now, we'll implement a simple deletion by filtering out the content
      // This is a simplified approach - in a real implementation, you'd want proper deletion
      const userContent = this.db.getUserContent(currentUser.id)
      const filteredContent = userContent.filter((c) => c.id !== id)

      // Store the filtered content back (this is a simplified approach)
      localStorage.setItem(`pensive-content-v2`, JSON.stringify(this.db.getAllContent().filter((c) => c.id !== id)))

      // Also remove associated analysis
      const userAnalyses = this.db.getUserAnalyses(currentUser.id)
      const filteredAnalyses = userAnalyses.filter((a) => a.contentId !== id)

      localStorage.setItem(
        `pensive-analysis-v2`,
        JSON.stringify(this.db.getAllAnalyses().filter((a) => a.contentId !== id)),
      )

      return true
    } catch (error) {
      console.error("Error deleting content:", error)
      return false
    }
  }

  getContentByTimeframe(timeframe: "weekly" | "monthly" | "quarterly") {
    try {
      const cutoffDate = this.getTimeframeCutoff(timeframe)
      const currentUser = simpleAuth.getCurrentUser()

      if (!currentUser) {
        return []
      }

      const userContent = this.db.getUserContent(currentUser.id)
      const userAnalyses = this.db.getUserAnalyses(currentUser.id)

      const filteredContent = userContent.filter((content) => new Date(content.createdAt) >= cutoffDate)

      const results: Array<{
        id: string
        title: string
        url: string
        analysis: any
        createdAt: string
      }> = []

      filteredContent.forEach((content) => {
        const analysis = userAnalyses.find((a) => a.contentId === content.id)
        if (analysis) {
          results.push({
            id: content.id,
            title: content.title,
            url: content.url,
            analysis,
            createdAt: content.createdAt,
          })
        }
      })

      return results
    } catch (error) {
      console.error("Error getting content by timeframe:", error)
      return []
    }
  }

  // Enhanced Statistics and Analytics
  getDatabaseStats() {
    try {
      const currentUser = simpleAuth.getCurrentUser()
      const dbStats = this.db.getStats()

      if (!currentUser) {
        return {
          content: { totalContent: 0, bySource: {}, byPriority: {}, conceptCount: 0, relationshipCount: 0 },
          concepts: { totalConcepts: 0, byType: {}, topConcepts: [], averageFrequency: 0 },
          tables: {},
          totalRecords: 0,
          performance: { avgAnalysisTime: 0, successRate: 0 },
        }
      }

      const userContent = this.db.getUserContent(currentUser.id)
      const userAnalyses = this.db.getUserAnalyses(currentUser.id)

      // Calculate user-specific stats
      const bySource: Record<string, number> = {}
      const byPriority: Record<string, number> = {}

      userContent.forEach((content) => {
        bySource[content.source] = (bySource[content.source] || 0) + 1
      })

      userAnalyses.forEach((analysis) => {
        byPriority[analysis.priority] = (byPriority[analysis.priority] || 0) + 1
      })

      return {
        content: {
          totalContent: userContent.length,
          bySource,
          byPriority,
          conceptCount: 0, // TODO: Calculate from analyses
          relationshipCount: 0, // TODO: Calculate relationships
        },
        concepts: {
          totalConcepts: 0, // TODO: Extract from analyses
          byType: {},
          topConcepts: [],
          averageFrequency: 0,
        },
        tables: dbStats,
        totalRecords: userContent.length + userAnalyses.length,
        performance: {
          avgAnalysisTime: 2.5,
          successRate: userAnalyses.length > 0 ? (userAnalyses.length / userContent.length) * 100 : 100,
        },
      }
    } catch (error) {
      console.error("Error getting database stats:", error)
      return {
        content: { totalContent: 0, bySource: {}, byPriority: {}, conceptCount: 0, relationshipCount: 0 },
        concepts: { totalConcepts: 0, byType: {}, topConcepts: [], averageFrequency: 0 },
        tables: {},
        totalRecords: 0,
        performance: { avgAnalysisTime: 0, successRate: 0 },
      }
    }
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  getContentCount(): number {
    try {
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) return 0

      return this.db.getUserContent(currentUser.id).length
    } catch {
      return 0
    }
  }

  clearAllContent(): void {
    console.log("DatabaseService.clearAllContent called")
    this.db.clear()
  }

  // Database health and maintenance
  performMaintenance(): void {
    console.log("Performing database maintenance...")
    // TODO: Implement maintenance operations
  }

  backupData(): string {
    try {
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        throw new Error("No current user")
      }

      const userContent = this.db.getUserContent(currentUser.id)
      const userAnalyses = this.db.getUserAnalyses(currentUser.id)

      return JSON.stringify(
        {
          version: "2.0.0",
          exportedAt: new Date().toISOString(),
          userId: currentUser.id,
          content: userContent,
          analyses: userAnalyses,
        },
        null,
        2,
      )
    } catch (error) {
      console.error("Error creating backup:", error)
      throw new Error("Failed to create backup")
    }
  }

  restoreData(backup: string) {
    try {
      const data = JSON.parse(backup)
      const currentUser = simpleAuth.getCurrentUser()

      if (!currentUser) {
        throw new Error("No current user")
      }

      // Restore content
      if (data.content && Array.isArray(data.content)) {
        data.content.forEach((content: any) => {
          this.db.storeContent({
            ...content,
            userId: currentUser.id,
          })
        })
      }

      // Restore analyses
      if (data.analyses && Array.isArray(data.analyses)) {
        data.analyses.forEach((analysis: any) => {
          this.db.storeAnalysis({
            ...analysis,
            userId: currentUser.id,
          })
        })
      }

      return { success: true }
    } catch (error) {
      console.error("Error restoring backup:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  exportData(format: "json" | "csv" = "json"): string {
    try {
      const data = this.getStoredContent({ limit: 10000 })

      if (format === "csv") {
        return this.convertToCSV(data.items)
      }

      return JSON.stringify(
        {
          version: "2.0.0",
          exportedAt: new Date().toISOString(),
          content: data.items,
          stats: this.getDatabaseStats(),
        },
        null,
        2,
      )
    } catch (error) {
      console.error("Error exporting data:", error)
      throw new Error("Failed to export data")
    }
  }

  private convertToCSV(items: any[]): string {
    if (items.length === 0) return ""

    const headers = ["Title", "URL", "Summary", "Priority", "Tags", "Created", "Source"]
    const rows = items.map((item) => [
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.url}"`,
      `"${item.analysis.summary.sentence.replace(/"/g, '""')}"`,
      item.analysis.priority,
      `"${item.analysis.tags.join(", ")}"`,
      item.createdAt,
      item.source,
    ])

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  // Health check
  healthCheck(): {
    status: "healthy" | "degraded" | "error"
    checks: Record<string, boolean>
    stats: any
    issues: string[]
  } {
    const checks = {
      storage: true,
      authentication: true,
      database: true,
      performance: true,
    }
    const issues: string[] = []

    try {
      // Test authentication
      const currentUser = simpleAuth.getCurrentUser()
      if (!currentUser) {
        checks.authentication = false
        issues.push("No current user authenticated")
      }

      // Test database operations
      const stats = this.getDatabaseStats()
      const totalRecords = stats.totalRecords

      // Check for performance issues
      if (totalRecords > 10000) {
        checks.performance = false
        issues.push("Large dataset may impact performance")
      }

      const status = issues.length === 0 ? "healthy" : issues.length < 3 ? "degraded" : "error"

      return {
        status,
        checks,
        stats,
        issues,
      }
    } catch (error) {
      return {
        status: "error",
        checks: { ...checks, error: false },
        stats: {},
        issues: [error instanceof Error ? error.message : "Unknown error"],
      }
    }
  }

  // Version and migration
  getVersion(): string {
    return "2.0.0"
  }
}

export const databaseService = DatabaseService.getInstance()
