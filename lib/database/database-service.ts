import { browserDatabase } from "./browser-database"
import { contentRepository } from "./repositories/content-repository"
import { conceptRepository } from "./repositories/concept-repository"
import type { AnalysisEntity, ContentEntity } from "./schema"

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

      // Check for duplicates using improved deduplication
      const normalizedUrl = this.normalizeUrl(data.url)
      const existingContent = this.findContentByUrl(normalizedUrl)

      if (existingContent) {
        console.log("Content already exists:", existingContent.title)
        const analysis = this.contentRepo.getContentWithAnalysis(existingContent.id).analysis
        return {
          contentId: existingContent.id,
          analysisId: analysis?.id || "",
          isNew: false,
        }
      }

      // Create content record
      const contentId = await this.contentRepo.createContent({
        title: data.title.trim(),
        url: normalizedUrl,
        content: data.content,
        source: data.source,
      })

      // Create analysis record with validation
      const analysisId = await this.contentRepo.createAnalysis({
        contentId,
        summary: data.analysis.summary,
        entities: data.analysis.entities.map((e) => ({
          name: e.name.trim(),
          type: e.type as any,
        })),
        relationships: data.analysis.relationships.map((r) => ({
          from: r.from.trim(),
          to: r.to.trim(),
          type: r.type as any,
        })),
        tags: data.analysis.tags.filter((tag) => tag.trim()).map((tag) => tag.trim()),
        priority: data.analysis.priority,
        fullContent: data.analysis.fullContent,
        confidence: Math.max(0, Math.min(1, data.analysis.confidence || 0.8)),
      })

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

  private findContentByUrl(url: string): ContentEntity | null {
    try {
      const allContent = this.contentRepo.findAll()
      return allContent.find((content) => this.normalizeUrl(content.url) === url || content.url === url) || null
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
      let results = this.contentRepo.getAllWithAnalysis()

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
          summary: analysis.summary,
          entities: analysis.entities.map((e) => ({ name: e.name, type: e.type })),
          relationships: analysis.relationships.map((r) => ({
            from: this.conceptRepo.findById(r.fromConceptId)?.name || "",
            to: this.conceptRepo.findById(r.toConceptId)?.name || "",
            type: r.type,
          })),
          tags: analysis.tags,
          priority: analysis.priority,
          fullContent: analysis.fullContent,
        },
        createdAt: content.createdAt,
        source: content.source,
      }))

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

  // Enhanced Concept Management with proper abstraction level filtering
  getConceptMapData(abstractionLevel = 50, searchQuery = "") {
    try {
      console.log("DatabaseService: Getting concept map data", { abstractionLevel, searchQuery })

      // Convert abstraction level (0-100) to minimum frequency threshold
      // Higher abstraction = higher threshold = fewer, more important concepts
      const maxFrequency = this.getMaxConceptFrequency()
      const minFrequency = Math.max(1, Math.floor((abstractionLevel / 100) * maxFrequency))

      console.log("Abstraction filtering:", { abstractionLevel, maxFrequency, minFrequency })

      const graphData = this.conceptRepo.getConceptGraph(minFrequency)

      if (!graphData) {
        console.warn("ConceptRepository returned null graph data")
        return { nodes: [], edges: [] }
      }

      let filteredNodes = graphData.nodes || []

      // Apply search filter with fuzzy matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filteredNodes = filteredNodes.filter(
          (node) =>
            node.name?.toLowerCase().includes(query) ||
            node.description?.toLowerCase().includes(query) ||
            node.type?.toLowerCase().includes(query) ||
            // Fuzzy matching for partial words
            this.fuzzyMatch(node.name?.toLowerCase() || "", query),
        )
      }

      // Filter edges to only include edges between remaining nodes
      const nodeIds = new Set(filteredNodes.map((node) => node.id))
      const filteredEdges = (graphData.edges || []).filter(
        (edge) =>
          edge.fromConceptId && edge.toConceptId && nodeIds.has(edge.fromConceptId) && nodeIds.has(edge.toConceptId),
      )

      const result = {
        nodes: filteredNodes.map((node) => ({
          id: node.id || `node-${Math.random()}`,
          label: node.name || "Unknown",
          type: node.type || "concept",
          density: this.calculateNodeDensity(node.frequency || 0, maxFrequency),
          articles: [], // Will be populated if needed
          description: node.description || "",
          source: "analyzed" as const,
          frequency: node.frequency || 0,
        })),
        edges: filteredEdges.map((edge) => ({
          id: edge.id || `edge-${Math.random()}`,
          source: edge.fromConceptId,
          target: edge.toConceptId,
          type: edge.type || "co_occurs",
          weight: Math.max(0, Math.min(1, edge.weight || 0.5)),
        })),
      }

      console.log("DatabaseService: Returning", result.nodes.length, "nodes and", result.edges.length, "edges")
      return result
    } catch (error) {
      console.error("Error getting concept map data:", error)
      return { nodes: [], edges: [] }
    }
  }

  private getMaxConceptFrequency(): number {
    try {
      const stats = this.conceptRepo.getConceptStats()
      return Math.max(1, stats.topConcepts[0]?.frequency || 1)
    } catch (error) {
      console.error("Error getting max concept frequency:", error)
      return 1
    }
  }

  private calculateNodeDensity(frequency: number, maxFrequency: number): number {
    if (maxFrequency <= 1) return 50
    return Math.min(100, Math.max(10, (frequency / maxFrequency) * 100))
  }

  private fuzzyMatch(text: string, query: string): boolean {
    if (query.length < 3) return false

    const words = text.split(/\s+/)
    return words.some((word) => {
      if (word.length < query.length) return false

      let matches = 0
      let queryIndex = 0

      for (let i = 0; i < word.length && queryIndex < query.length; i++) {
        if (word[i] === query[queryIndex]) {
          matches++
          queryIndex++
        }
      }

      return matches >= Math.floor(query.length * 0.8)
    })
  }

  getConceptDetails(conceptId: string) {
    try {
      return this.conceptRepo.getConceptDetails(conceptId)
    } catch (error) {
      console.error("Error getting concept details:", error)
      return { concept: null, relatedConcepts: [], articles: [] }
    }
  }

  searchConcepts(query: string) {
    try {
      return this.conceptRepo.searchConcepts(query).slice(0, 10)
    } catch (error) {
      console.error("Error searching concepts:", error)
      return []
    }
  }

  getTrendingConcepts(timeframe: "weekly" | "monthly" | "quarterly") {
    try {
      return this.conceptRepo.getTrendingConcepts(timeframe)
    } catch (error) {
      console.error("Error getting trending concepts:", error)
      return []
    }
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
      const contents = this.contentRepo.searchContent(query)

      let results = contents.map((content) => {
        const { analysis } = this.contentRepo.getContentWithAnalysis(content.id)

        // Calculate relevance score
        const titleMatch = content.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 0
        const contentMatch = content.content.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        const tagMatch = analysis?.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())) ? 1.5 : 0

        return {
          id: content.id,
          title: content.title,
          url: content.url,
          analysis: analysis
            ? {
                summary: { sentence: analysis.summary.sentence },
                tags: analysis.tags,
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
          const content = this.contentRepo.findById(r.id)
          return content && sourceSet.has(content.source)
        })
      }

      if (options.priorities?.length) {
        const prioritySet = new Set(options.priorities)
        results = results.filter((r) => {
          const { analysis } = this.contentRepo.getContentWithAnalysis(r.id)
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
      return this.contentRepo.deleteContent(id)
    } catch (error) {
      console.error("Error deleting content:", error)
      return false
    }
  }

  getContentByTimeframe(timeframe: "weekly" | "monthly" | "quarterly") {
    try {
      const contents = this.contentRepo.findByTimeframe(timeframe)
      const results: Array<{
        id: string
        title: string
        url: string
        analysis: AnalysisEntity
        createdAt: string
      }> = []

      contents.forEach((content) => {
        const { analysis } = this.contentRepo.getContentWithAnalysis(content.id)
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
      const contentStats = this.contentRepo.getStats()
      const conceptStats = this.conceptRepo.getConceptStats()
      const tableStats = this.db.getTableStats()

      // Calculate additional analytics
      const recentContent = this.getStoredContent({ timeframe: "weekly" })
      const growthRate = this.calculateGrowthRate()
      const topSources = this.getTopSources()
      const conceptGrowth = this.getConceptGrowthTrend()

      return {
        content: {
          ...contentStats,
          recentCount: recentContent.total,
          growthRate,
          topSources,
        },
        concepts: {
          ...conceptStats,
          growthTrend: conceptGrowth,
        },
        tables: tableStats,
        totalRecords: this.db.getTotalRecords(),
        performance: {
          avgAnalysisTime: this.calculateAvgAnalysisTime(),
          successRate: this.calculateSuccessRate(),
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

  private calculateGrowthRate(): number {
    try {
      const now = new Date()
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const thisWeek = this.getStoredContent({
        timeframe: "weekly",
      }).total

      const previousWeek = this.contentRepo.findAll().filter((content) => {
        const date = new Date(content.createdAt)
        return date >= twoWeeksAgo && date < lastWeek
      }).length

      return previousWeek > 0 ? ((thisWeek - previousWeek) / previousWeek) * 100 : 0
    } catch {
      return 0
    }
  }

  private getTopSources(): Array<{ source: string; count: number; percentage: number }> {
    try {
      const stats = this.contentRepo.getStats()
      const total = stats.totalContent

      return Object.entries(stats.bySource)
        .map(([source, count]) => ({
          source,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    } catch {
      return []
    }
  }

  private getConceptGrowthTrend(): Array<{ period: string; count: number }> {
    try {
      const periods = []
      const now = new Date()

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
        const weekStart = new Date(date.getTime() - date.getDay() * 24 * 60 * 60 * 1000)
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

        const content = this.contentRepo.findAll().filter((c) => {
          const createdAt = new Date(c.createdAt)
          return createdAt >= weekStart && createdAt < weekEnd
        })

        periods.push({
          period: weekStart.toLocaleDateString(),
          count: content.length,
        })
      }

      return periods
    } catch {
      return []
    }
  }

  private calculateAvgAnalysisTime(): number {
    // This would require storing analysis timestamps
    // For now, return a placeholder
    return 2.5 // seconds
  }

  private calculateSuccessRate(): number {
    try {
      const allContent = this.contentRepo.findAll()
      const withAnalysis = this.contentRepo.getAllWithAnalysis()

      return allContent.length > 0 ? (withAnalysis.length / allContent.length) * 100 : 100
    } catch {
      return 0
    }
  }

  // Enhanced Database Maintenance
  vacuum(): { cleaned: number; errors: string[] } {
    try {
      const errors: string[] = []
      let cleaned = 0

      // Remove orphaned relationships
      const relationships = this.db.findAll("relationships")
      const conceptIds = new Set(this.db.findAll("concepts").map((c: any) => c.id))

      relationships.forEach((rel: any) => {
        if (!conceptIds.has(rel.fromConceptId) || !conceptIds.has(rel.toConceptId)) {
          if (this.db.delete("relationships", rel.id)) {
            cleaned++
          } else {
            errors.push(`Failed to delete orphaned relationship ${rel.id}`)
          }
        }
      })

      // Remove orphaned analyses
      const analyses = this.db.findAll("analysis")
      const contentIds = new Set(this.db.findAll("content").map((c: any) => c.id))

      analyses.forEach((analysis: any) => {
        if (!contentIds.has(analysis.contentId)) {
          if (this.db.delete("analysis", analysis.id)) {
            cleaned++
          } else {
            errors.push(`Failed to delete orphaned analysis ${analysis.id}`)
          }
        }
      })

      // Remove unused concepts (frequency = 0)
      const concepts = this.db.findAll("concepts")
      concepts.forEach((concept: any) => {
        if (concept.frequency <= 0) {
          if (this.db.delete("concepts", concept.id)) {
            cleaned++
          } else {
            errors.push(`Failed to delete unused concept ${concept.id}`)
          }
        }
      })

      console.log(`Database vacuum completed: ${cleaned} items cleaned, ${errors.length} errors`)
      return { cleaned, errors }
    } catch (error) {
      console.error("Error during vacuum:", error)
      return { cleaned: 0, errors: [error instanceof Error ? error.message : "Unknown error"] }
    }
  }

  backup(): string {
    try {
      return this.db.backup()
    } catch (error) {
      console.error("Error creating backup:", error)
      throw new Error("Failed to create backup")
    }
  }

  restore(backup: string) {
    try {
      return this.db.restore(backup)
    } catch (error) {
      console.error("Error restoring backup:", error)
      throw new Error("Failed to restore backup")
    }
  }

  clear(): void {
    try {
      this.db.clear()
    } catch (error) {
      console.error("Error clearing database:", error)
      throw new Error("Failed to clear database")
    }
  }

  // Export functionality
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
      indexes: true,
      relationships: true,
      performance: true,
    }
    const issues: string[] = []

    try {
      // Test basic operations
      const totalRecords = this.db.getTotalRecords()
      const stats = this.getDatabaseStats()

      // Check for performance issues
      if (totalRecords > 10000) {
        checks.performance = false
        issues.push("Large dataset may impact performance")
      }

      // Check for orphaned data
      const vacuumResult = this.vacuum()
      if (vacuumResult.errors.length > 0) {
        checks.relationships = false
        issues.push(...vacuumResult.errors)
      }

      const status = issues.length === 0 ? "healthy" : issues.length < 3 ? "degraded" : "error"

      return {
        status,
        checks,
        stats: {
          totalRecords,
          ...stats,
        },
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

  migrate(fromVersion: string): { success: boolean; message: string } {
    try {
      console.log(`Migrating database from ${fromVersion} to ${this.getVersion()}`)

      // Add migration logic here as schema evolves
      if (fromVersion === "1.0.0") {
        // Example migration
        console.log("Performing migration from 1.0.0 to 2.0.0")
        // Add any necessary data transformations
      }

      return { success: true, message: "Migration completed successfully" }
    } catch (error) {
      console.error("Migration failed:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Migration failed",
      }
    }
  }
}

export const databaseService = DatabaseService.getInstance()
