import { databaseService } from "./database/database-service"

export interface ContentAnalysis {
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

export interface StoredContent {
  id: string
  url: string
  title: string
  content: string
  analysis: ContentAnalysis
  createdAt: string
  source: string
}

export interface DigestItem {
  title: string
  summary: string
  fullSummary?: string
  summaryType: "paragraph" | "full-read"
  priority: "skim" | "read" | "deep-dive"
  url?: string
  conceptTags: string[]
  analyzedAt: string
  fullContent?: string
  source: string
}

export class ContentProcessor {
  static async analyzeContent(params: {
    url?: string
    content?: string
    title?: string
  }): Promise<ContentAnalysis> {
    console.log("ContentProcessor.analyzeContent called with:", {
      hasUrl: !!params.url,
      hasContent: !!params.content,
      hasTitle: !!params.title,
      contentLength: params.content?.length,
    })

    try {
      const response = await fetch("/api/grok/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })

      console.log("Analysis API response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Analysis API error:", response.status, errorText)
        throw new Error(`Analysis failed (${response.status}): ${errorText}`)
      }

      const rawAnalysis = await response.json()
      console.log("Raw analysis result:", rawAnalysis)

      let analysis: ContentAnalysis

      if (rawAnalysis.error) {
        throw new Error(rawAnalysis.error)
      }

      if (rawAnalysis.summary && rawAnalysis.entities) {
        analysis = rawAnalysis
      } else {
        console.error("Invalid analysis structure:", rawAnalysis)
        analysis = {
          summary: {
            sentence: `Analysis of "${params.title || "Content"}"`,
            paragraph: params.content ? params.content.substring(0, 500) + "..." : "Content analysis summary",
            isFullRead: false,
          },
          entities: [{ name: "General Content", type: "concept" }],
          relationships: [],
          tags: ["analysis", "content"],
          priority: "read" as const,
          fullContent: params.content,
          confidence: 0.5,
          source: params.url ? new URL(params.url).hostname : "manual",
          analyzedAt: new Date().toISOString(),
        }
      }

      console.log("Processed analysis:", analysis)

      if (params.url && params.content && params.title) {
        console.log("Storing content in database...")
        try {
          const result = await databaseService.storeAnalyzedContent({
            title: params.title,
            url: params.url,
            content: params.content,
            source: analysis.source,
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
          console.log("Content stored successfully:", result)
        } catch (storageError) {
          console.error("Error storing content in database:", storageError)
        }
      }

      return analysis
    } catch (error) {
      console.error("ContentProcessor.analyzeContent error:", error)

      return {
        summary: {
          sentence: `Analysis of "${params.title || "Content"}" (Error occurred)`,
          paragraph: "An error occurred during analysis. This is a fallback summary.",
          isFullRead: false,
        },
        entities: [{ name: "Error Analysis", type: "concept" }],
        relationships: [],
        tags: ["error", "fallback"],
        priority: "skim" as const,
        fullContent: params.content,
        confidence: 0.1,
        source: params.url ? new URL(params.url).hostname : "error",
        analyzedAt: new Date().toISOString(),
      }
    }
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

  static getAnalytics() {
    return databaseService.getDatabaseStats()
  }

  static healthCheck() {
    return databaseService.healthCheck()
  }

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

// Export individual functions for backward compatibility
export const analyzeUrl = ContentProcessor.analyzeUrl.bind(ContentProcessor)
export const generateDigest = ContentProcessor.generateDigest.bind(ContentProcessor)
export const getStoredContent = ContentProcessor.getStoredContent.bind(ContentProcessor)
export const storeContent = (content: StoredContent) => {
  // This is a compatibility function - the actual storage is handled in analyzeContent
  console.log("Legacy storeContent called, content should be stored via analyzeContent")
}

// DO NOT EXPORT processContent - this function does not exist
