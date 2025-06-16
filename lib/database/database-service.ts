import { OptimizedDatabase } from "./optimized-database"

interface StoredContent {
  id: string
  title: string
  url: string
  content: string
  source: string
  createdAt: string
  analysis: {
    summary: {
      sentence: string
      paragraph: string
      isFullRead: boolean
    }
    entities: Array<{
      name: string
      type: string
    }>
    relationships: Array<{
      from: string
      to: string
      type: string
    }>
    tags: string[]
    priority: string
    fullContent?: string
    confidence?: number
  }
}

interface DatabaseStats {
  content: {
    totalContent: number
    bySource: Record<string, number>
    byPriority: Record<string, number>
  }
  concepts: {
    totalConcepts: number
    totalRelationships: number
  }
  performance: {
    lastVacuum: string
    dbSize: number
  }
}

class DatabaseService {
  private db: OptimizedDatabase

  constructor() {
    this.db = new OptimizedDatabase()
  }

  async storeAnalyzedContent(params: {
    title: string
    url: string
    content: string
    source: string
    analysis: any
  }): Promise<{ contentId: string }> {
    console.log("DatabaseService.storeAnalyzedContent called")

    try {
      const contentId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const storedContent: StoredContent = {
        id: contentId,
        title: params.title,
        url: params.url,
        content: params.content,
        source: params.source,
        createdAt: new Date().toISOString(),
        analysis: params.analysis,
      }

      // Store in the optimized database
      this.db.storeContent(storedContent)

      console.log("Content stored successfully:", contentId)
      return { contentId }
    } catch (error) {
      console.error("Error storing content:", error)
      throw error
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
  ): { items: StoredContent[]; total: number } {
    console.log("DatabaseService.getStoredContent called with options:", options)

    try {
      const allContent = this.db.getAllContent()
      let filteredContent = allContent

      // Apply filters
      if (options.source) {
        filteredContent = filteredContent.filter((item) => item.source === options.source)
      }

      if (options.priority) {
        filteredContent = filteredContent.filter((item) => item.analysis.priority === options.priority)
      }

      if (options.timeframe) {
        const now = new Date()
        let cutoffDate: Date

        switch (options.timeframe) {
          case "weekly":
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case "monthly":
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          case "quarterly":
            cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            break
          default:
            cutoffDate = new Date(0)
        }

        filteredContent = filteredContent.filter((item) => new Date(item.createdAt) >= cutoffDate)
      }

      // Apply pagination
      const offset = options.offset || 0
      const limit = options.limit || 50
      const paginatedContent = filteredContent.slice(offset, offset + limit)

      return {
        items: paginatedContent,
        total: filteredContent.length,
      }
    } catch (error) {
      console.error("Error getting stored content:", error)
      return { items: [], total: 0 }
    }
  }

  getContentByTimeframe(timeframe: "weekly" | "monthly" | "quarterly"): StoredContent[] {
    console.log("DatabaseService.getContentByTimeframe called:", timeframe)
    const result = this.getStoredContent({ timeframe })
    return result.items
  }

  deleteContent(id: string): boolean {
    console.log("DatabaseService.deleteContent called:", id)
    try {
      return this.db.deleteContent(id)
    } catch (error) {
      console.error("Error deleting content:", error)
      return false
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
  ): StoredContent[] {
    console.log("DatabaseService.searchContent called:", query, options)

    try {
      const allContent = this.db.getAllContent()
      const queryLower = query.toLowerCase()

      let results = allContent.filter(
        (item) =>
          item.title.toLowerCase().includes(queryLower) ||
          item.content.toLowerCase().includes(queryLower) ||
          item.analysis.summary.sentence.toLowerCase().includes(queryLower) ||
          item.analysis.tags.some((tag) => tag.toLowerCase().includes(queryLower)),
      )

      // Apply filters
      if (options.sources && options.sources.length > 0) {
        results = results.filter((item) => options.sources!.includes(item.source))
      }

      if (options.priorities && options.priorities.length > 0) {
        results = results.filter((item) => options.priorities!.includes(item.analysis.priority))
      }

      if (options.dateRange) {
        results = results.filter((item) => {
          const itemDate = new Date(item.createdAt)
          return itemDate >= options.dateRange!.start && itemDate <= options.dateRange!.end
        })
      }

      // Apply limit
      const limit = options.limit || 20
      return results.slice(0, limit)
    } catch (error) {
      console.error("Error searching content:", error)
      return []
    }
  }

  getDatabaseStats(): DatabaseStats {
    try {
      const allContent = this.db.getAllContent()

      const bySource: Record<string, number> = {}
      const byPriority: Record<string, number> = {}

      allContent.forEach((item) => {
        bySource[item.source] = (bySource[item.source] || 0) + 1
        byPriority[item.analysis.priority] = (byPriority[item.analysis.priority] || 0) + 1
      })

      return {
        content: {
          totalContent: allContent.length,
          bySource,
          byPriority,
        },
        concepts: {
          totalConcepts: 0, // TODO: Implement concept counting
          totalRelationships: 0, // TODO: Implement relationship counting
        },
        performance: {
          lastVacuum: new Date().toISOString(),
          dbSize: allContent.length * 1000, // Rough estimate
        },
      }
    } catch (error) {
      console.error("Error getting database stats:", error)
      return {
        content: { totalContent: 0, bySource: {}, byPriority: {} },
        concepts: { totalConcepts: 0, totalRelationships: 0 },
        performance: { lastVacuum: new Date().toISOString(), dbSize: 0 },
      }
    }
  }

  clear(): void {
    console.log("DatabaseService.clear called")
    this.db.clear()
  }

  vacuum(): void {
    console.log("DatabaseService.vacuum called")
    // Placeholder for database maintenance
  }

  backup(): string {
    console.log("DatabaseService.backup called")
    try {
      const allContent = this.db.getAllContent()
      return JSON.stringify({
        version: "1.0",
        timestamp: new Date().toISOString(),
        content: allContent,
      })
    } catch (error) {
      console.error("Error creating backup:", error)
      return "{}"
    }
  }

  restore(backup: string): boolean {
    console.log("DatabaseService.restore called")
    try {
      const data = JSON.parse(backup)
      if (data.content && Array.isArray(data.content)) {
        this.db.clear()
        data.content.forEach((item: StoredContent) => {
          this.db.storeContent(item)
        })
        return true
      }
      return false
    } catch (error) {
      console.error("Error restoring backup:", error)
      return false
    }
  }

  exportData(format: "json" | "csv" = "json"): string {
    console.log("DatabaseService.exportData called:", format)
    try {
      const allContent = this.db.getAllContent()

      if (format === "json") {
        return JSON.stringify(allContent, null, 2)
      } else {
        // Simple CSV export
        const headers = ["ID", "Title", "URL", "Source", "Priority", "Created At"]
        const rows = allContent.map((item) => [
          item.id,
          item.title,
          item.url,
          item.source,
          item.analysis.priority,
          item.createdAt,
        ])

        return [headers, ...rows].map((row) => row.join(",")).join("\n")
      }
    } catch (error) {
      console.error("Error exporting data:", error)
      return ""
    }
  }

  healthCheck(): { status: "healthy" | "error"; message: string } {
    try {
      const stats = this.getDatabaseStats()
      return {
        status: "healthy",
        message: `Database healthy with ${stats.content.totalContent} items`,
      }
    } catch (error) {
      return {
        status: "error",
        message: `Database error: ${error}`,
      }
    }
  }

  async processRSSHistoricalArchive(
    rssUrl: string,
    maxItems = 50,
  ): Promise<{
    processed: number
    errors: string[]
    items: any[]
  }> {
    console.log("DatabaseService.processRSSHistoricalArchive called:", rssUrl, maxItems)

    // Mock RSS processing for now
    const mockItems = Array.from({ length: Math.min(maxItems, 10) }, (_, i) => ({
      title: `RSS Article ${i + 1}`,
      url: `${rssUrl}/article-${i + 1}`,
      content: `Mock content for RSS article ${i + 1} from ${rssUrl}`,
      pubDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    }))

    const processed = mockItems.length
    const errors: string[] = []

    // Store each item
    for (const item of mockItems) {
      try {
        await this.storeAnalyzedContent({
          title: item.title,
          url: item.url,
          content: item.content,
          source: "rss-archive",
          analysis: {
            summary: {
              sentence: `Summary of ${item.title}`,
              paragraph: `Detailed analysis of ${item.title} from RSS feed processing.`,
              isFullRead: false,
            },
            entities: [{ name: "RSS Content", type: "concept" }],
            relationships: [],
            tags: ["rss", "archive", "processed"],
            priority: "read",
            confidence: 0.8,
          },
        })
      } catch (error) {
        errors.push(`Failed to process ${item.title}: ${error}`)
      }
    }

    return {
      processed,
      errors,
      items: mockItems,
    }
  }
}

export const databaseService = new DatabaseService()
