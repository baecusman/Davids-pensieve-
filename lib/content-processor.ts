import { databaseService } from "./database/database-service"

interface ContentAnalysis {
  summary: {
    sentence: string
    paragraph: string
    isFullRead: boolean
  }
  entities: Array<{
    name: string
    type: "concept" | "person" | "organization" | "technology" | "methodology"
  }>
  relationships: Array<{
    from: string
    to: string
    type: "INCLUDES" | "RELATES_TO" | "IMPLEMENTS" | "USES" | "COMPETES_WITH"
  }>
  tags: string[]
  priority: "skim" | "read" | "deep-dive"
  fullContent?: string
  analyzedAt: string
  source: string
  confidence?: number
}

export class ContentProcessor {
  static async analyzeContent(params: {
    url?: string
    content?: string
    title?: string
  }): Promise<ContentAnalysis> {
    console.log("ContentProcessor.analyzeContent called with:", params)

    const response = await fetch("/api/grok/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Analysis API error:", response.status, errorText)
      throw new Error(`Analysis failed: ${response.statusText}`)
    }

    const analysis = await response.json()
    console.log("Analysis result:", analysis)

    // Store the analyzed content in the database
    if (params.url && params.content && params.title) {
      console.log("Storing content in database...")
      try {
        const result = await databaseService.storeAnalyzedContent({
          title: params.title,
          url: params.url,
          content: params.content,
          source: analysis.source || "manual",
          analysis: {
            summary: analysis.summary,
            entities: analysis.entities,
            relationships: analysis.relationships,
            tags: analysis.tags,
            priority: analysis.priority,
            fullContent: analysis.fullContent,
            confidence: analysis.confidence || 0.8,
          },
        })
        console.log("Content stored:", result)
      } catch (error) {
        console.error("Error storing content in database:", error)
        // Don't fail the analysis if storage fails
      }
    }

    return analysis
  }

  static async analyzeUrl(url: string): Promise<ContentAnalysis> {
    console.log("ContentProcessor.analyzeUrl called with:", url)

    try {
      const contentResponse = await fetch(`/api/content/fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      if (!contentResponse.ok) {
        const errorText = await contentResponse.text()
        console.error("Content fetch error:", contentResponse.status, errorText)
        throw new Error("Failed to fetch content")
      }

      const { content, title } = await contentResponse.json()
      console.log("Fetched content:", { title, contentLength: content?.length })

      return this.analyzeContent({ url, content, title })
    } catch (error) {
      console.error("Error fetching content:", error)
      throw error
    }
  }

  static async generateDigest(timeframe: "weekly" | "monthly" | "quarterly", articles?: any[]) {
    let digestItems = articles

    // If no articles provided, get from database
    if (!digestItems) {
      const storedArticles = databaseService.getContentByTimeframe(timeframe)

      if (storedArticles.length === 0) {
        throw new Error(`No articles found for ${timeframe} digest`)
      }

      digestItems = storedArticles.map((article) => ({
        title: article.title,
        summary: article.analysis.summary.sentence,
        fullSummary: article.analysis.summary.paragraph,
        summaryType: article.analysis.summary.isFullRead ? ("full-read" as const) : ("paragraph" as const),
        priority: article.analysis.priority,
        url: article.url,
        conceptTags: article.analysis.tags,
        analyzedAt: article.createdAt,
        fullContent: article.analysis.fullContent,
        source: "analyzed",
      }))
    }

    const response = await fetch("/api/digest/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeframe,
        articles: digestItems,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to generate digest")
    }

    return response.json()
  }

  static getStoredContent(
    options: {
      limit?: number
      offset?: number
      source?: string
      priority?: string
      timeframe?: "weekly" | "monthly" | "quarterly"
    } = {},
  ) {
    const result = databaseService.getStoredContent(options)
    console.log("ContentProcessor.getStoredContent returning:", result.items.length, "items")
    return result.items
  }

  static deleteContent(id: string): boolean {
    console.log("ContentProcessor.deleteContent called with ID:", id)
    const result = databaseService.deleteContent(id)
    console.log("Delete result:", result)
    return result
  }

  static searchContent(
    query: string,
    options: {
      limit?: number
      sources?: string[]
      priorities?: string[]
      dateRange?: { start: Date; end: Date }
    } = {},
  ) {
    return databaseService.searchContent(query, options)
  }

  static getContentCount(): number {
    const stats = databaseService.getDatabaseStats()
    return stats.content.totalContent
  }

  static clearAllContent(): void {
    console.log("ContentProcessor.clearAllContent called")
    databaseService.clear()
  }

  // Database health and maintenance
  static getDatabaseStats() {
    return databaseService.getDatabaseStats()
  }

  static performMaintenance(): void {
    console.log("Performing database maintenance...")
    databaseService.vacuum()
  }

  static backupData(): string {
    return databaseService.backup()
  }

  static restoreData(backup: string) {
    return databaseService.restore(backup)
  }

  static exportData(format: "json" | "csv" = "json"): string {
    return databaseService.exportData(format)
  }

  // Enhanced search with filters
  static advancedSearch(
    query: string,
    filters: {
      sources?: string[]
      priorities?: string[]
      dateRange?: { start: Date; end: Date }
      tags?: string[]
      limit?: number
    } = {},
  ) {
    return databaseService.searchContent(query, {
      limit: filters.limit || 20,
      sources: filters.sources,
      priorities: filters.priorities,
      dateRange: filters.dateRange,
    })
  }

  // Get analytics data
  static getAnalytics() {
    return databaseService.getDatabaseStats()
  }

  // Health check
  static healthCheck() {
    return databaseService.healthCheck()
  }

  // Legacy compatibility method (for test data)
  static async addTestContent(testData: any): Promise<string> {
    console.log("Adding test content via legacy method:", testData.title)
    try {
      const result = await databaseService.storeAnalyzedContent({
        title: testData.title,
        url: testData.url,
        content: testData.content,
        source: testData.source || "test-data",
        analysis: testData.analysis,
      })
      return result.contentId
    } catch (error) {
      console.error("Error adding test content:", error)
      return "error"
    }
  }
}
