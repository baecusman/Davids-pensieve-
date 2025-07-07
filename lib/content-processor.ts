import { databaseService } from "./database/database-service"
import type { ConceptEntity } from "./database/schema"; // For typing if needed

interface ContentAnalysis {
  summary: {
    sentence: string
    paragraph: string
    isFullRead: boolean
  }
  entities: Array<{ // Ensure this matches ConceptEntity structure or is mapped
    name: string
    type: ConceptEntity["type"] // Use specific type from schema
  }>
  relationships: Array<{ // Ensure this matches RelationshipEntity structure or is mapped
    from: string
    to: string
    type: string // Define specific relationship types if available
  }>
  tags: string[]
  priority: "skim" | "read" | "deep-dive"
  fullContent?: string
  analyzedAt: string // This seems to be set by the API, not by storeAnalyzedContent
  source: string
  confidence?: number
}

export class ContentProcessor {
  static async analyzeContent(params: {
    url?: string
    content?: string
    title?: string
  }): Promise<ContentAnalysis> { // Return type is the fetched analysis
    console.log("ContentProcessor.analyzeContent called with:", params)

    const response = await fetch("/api/grok/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Analysis API error:", response.status, errorText)
      throw new Error(`Analysis failed: ${response.statusText}`)
    }

    const analysisResult: ContentAnalysis = await response.json() // Explicitly type the result
    console.log("Analysis result:", analysisResult)

    if (params.url && params.content && params.title) {
      console.log("Storing content in database...")
      try {
        // The databaseService.storeAnalyzedContent now returns { contentId, analysisId, isNew }
        // We don't directly use these IDs here but log them.
        const storeResult = await databaseService.storeAnalyzedContent({
          title: params.title,
          url: params.url,
          content: params.content,
          source: analysisResult.source || "manual", // Use source from analysis result
          analysis: { // Pass the relevant parts of analysisResult
            summary: analysisResult.summary,
            entities: analysisResult.entities,
            relationships: analysisResult.relationships,
            tags: analysisResult.tags,
            priority: analysisResult.priority,
            fullContent: analysisResult.fullContent,
            confidence: analysisResult.confidence,
          },
        })
        console.log("Content stored in DB:", storeResult)
      } catch (error) {
        console.error("Error storing content in database:", error)
        // Decide if this should throw or just log. Original code logs.
      }
    }
    return analysisResult // Return the original analysis from the API
  }

  static async analyzeUrl(url: string): Promise<ContentAnalysis> {
    console.log("ContentProcessor.analyzeUrl called with:", url)
    try {
      const contentResponse = await fetch(`/api/content/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      console.error("Error fetching content for analysis:", error)
      throw error // Re-throw to be handled by caller
    }
  }

  static async generateDigest(timeframe: "weekly" | "monthly" | "quarterly", articles?: any[]) {
    let digestItems = articles
    if (!digestItems) {
      // databaseService.getContentByTimeframe is now async
      const storedArticles = await databaseService.getContentByTimeframe(timeframe)
      if (!storedArticles || storedArticles.length === 0) { // Add null check
        throw new Error(`No articles found for ${timeframe} digest`)
      }
      digestItems = storedArticles.map((article) => ({
        title: article.title,
        // Ensure article.analysis is not null before accessing its properties
        summary: article.analysis?.summary?.sentence || "Summary not available",
        fullSummary: article.analysis?.summary?.paragraph || "",
        summaryType: article.analysis?.summary?.isFullRead ? ("full-read" as const) : ("paragraph" as const),
        priority: article.analysis?.priority || "skim",
        url: article.url,
        conceptTags: article.analysis?.tags || [],
        analyzedAt: article.createdAt, // This was article.createdAt
        fullContent: article.analysis?.fullContent,
        source: "analyzed",
      }))
    }

    const response = await fetch("/api/digest/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeframe, articles: digestItems }),
    })

    if (!response.ok) {
      throw new Error("Failed to generate digest")
    }
    return response.json()
  }

  static async getStoredContent(
    options: {
      limit?: number
      offset?: number
      source?: string
      priority?: string
      timeframe?: "weekly" | "monthly" | "quarterly"
    } = {},
  ) {
    // databaseService.getStoredContent is now async and returns an object { items, total, hasMore }
    const result = await databaseService.getStoredContent(options)
    console.log("ContentProcessor.getStoredContent returning:", result.items.length, "items")
    return result.items // Assuming callers expect only the items array
  }

  static async deleteContent(id: string): Promise<boolean> {
    console.log("ContentProcessor.deleteContent called with ID:", id)
    // databaseService.deleteContent is now async
    const result = await databaseService.deleteContent(id)
    console.log("Delete result:", result)
    return result
  }

  static async searchContent(
    query: string,
    options: {
      limit?: number
      sources?: string[]
      priorities?: string[]
      dateRange?: { start: Date; end: Date }
    } = {},
  ) {
    // databaseService.searchContent is now async
    return await databaseService.searchContent(query, options)
  }

  static async getContentCount(): Promise<number> {
    // databaseService.getDatabaseStats is now getApplicationStats and async
    const stats = await databaseService.getApplicationStats()
    return stats.content.totalContent || 0 // Adjust path based on new stats structure
  }

  static clearAllContent(): void {
    console.warn("ContentProcessor.clearAllContent called, but databaseService.clear() was removed as it was browserDB specific. No action taken for Supabase.")
    // Original call: databaseService.clear() - This was removed.
    // Supabase data clearing would typically be done via SQL or dashboard, not usually from client-side service.
  }

  static async getDatabaseStats() { // Renamed for clarity, was getDatabaseStats
    // Should call the new getApplicationStats and it's async
    return await databaseService.getApplicationStats()
  }

  static performMaintenance(): void {
    console.warn("ContentProcessor.performMaintenance called, but databaseService.vacuum() was removed. No action taken for Supabase.")
    // Original call: databaseService.vacuum() - This was removed.
  }

  static backupData(): string {
    console.warn("ContentProcessor.backupData called, but databaseService.backup() was removed. Returning empty string.")
    return "" // Original: databaseService.backup()
  }

  static restoreData(backup: string) {
    console.warn("ContentProcessor.restoreData called, but databaseService.restore() was removed. No action taken.")
    // Original: databaseService.restore(backup)
    return { success: false, error: "Not supported with Supabase backend from client." }
  }

  static async exportData(format: "json" | "csv" = "json"): Promise<string> {
    // databaseService.exportData is now async
    return await databaseService.exportData(format)
  }

  static async advancedSearch(
    query: string,
    filters: {
      sources?: string[]
      priorities?: string[]
      dateRange?: { start: Date; end: Date }
      tags?: string[] // This filter was not used in the original call to searchContent
      limit?: number
    } = {},
  ) {
    // databaseService.searchContent is now async
    return await databaseService.searchContent(query, {
      limit: filters.limit || 20,
      sources: filters.sources,
      priorities: filters.priorities,
      dateRange: filters.dateRange,
      // 'tags' filter needs to be handled if searchContent supports it, or filtered post-fetch.
    })
  }

  static async getAnalytics() {
    // Alias for getDatabaseStats, should call the new getApplicationStats and it's async
    return await databaseService.getApplicationStats()
  }

  static async healthCheck() {
    // databaseService.healthCheck is now async
    return await databaseService.healthCheck()
  }

  static async addTestContent(testData: any): Promise<string | null> { // Return type changed
    console.log("Adding test content via legacy method:", testData.title)
    try {
      const result = await databaseService.storeAnalyzedContent({
        title: testData.title,
        url: testData.url,
        content: testData.content,
        source: testData.source || "test-data",
        analysis: testData.analysis, // Ensure testData.analysis matches expected structure
      })
      // storeAnalyzedContent returns { contentId, analysisId, isNew }
      return result.contentId // Return the contentId
    } catch (error) {
      console.error("Error adding test content:", error)
      return null // Return null on error
    }
  }
}
