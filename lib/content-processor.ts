export interface ContentAnalysis {
  summary: {
    sentence: string
    paragraph: string
    isFullRead: boolean
  }
  tags: string[]
  priority: "skim" | "read" | "deep-dive"
  fullContent?: string
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

export interface GeneratedDigest {
  timeframe: "weekly" | "monthly" | "quarterly"
  summary: string
  items: DigestItem[]
  trendingConcepts: Array<{
    name: string
    reason: string
    importance: string
  }>
  stats: {
    totalArticles: number
    deepDiveCount: number
    readCount: number
    skimCount: number
    analyzedArticles?: number
  }
  generatedAt: string
}

export class ContentProcessor {
  private static readonly STORAGE_KEY = "pensive_content"
  private static readonly MAX_STORED_ITEMS = 1000

  // Store content in localStorage
  static storeContent(content: StoredContent): void {
    try {
      const stored = this.getStoredContent({ limit: this.MAX_STORED_ITEMS - 1 })
      const updated = [content, ...stored]
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated))
      console.log("Content stored successfully:", content.title)
    } catch (error) {
      console.error("Error storing content:", error)
    }
  }

  // Get stored content with filtering options
  static getStoredContent(
    options: {
      limit?: number
      timeframe?: "weekly" | "monthly" | "quarterly"
      tags?: string[]
    } = {},
  ): StoredContent[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      let content: StoredContent[] = JSON.parse(stored)

      // Apply timeframe filter
      if (options.timeframe) {
        const now = new Date()
        const cutoff = new Date()

        switch (options.timeframe) {
          case "weekly":
            cutoff.setDate(now.getDate() - 7)
            break
          case "monthly":
            cutoff.setMonth(now.getMonth() - 1)
            break
          case "quarterly":
            cutoff.setMonth(now.getMonth() - 3)
            break
        }

        content = content.filter((item) => new Date(item.createdAt) >= cutoff)
      }

      // Apply tag filter
      if (options.tags && options.tags.length > 0) {
        content = content.filter((item) => options.tags!.some((tag) => item.analysis.tags.includes(tag)))
      }

      // Apply limit
      if (options.limit) {
        content = content.slice(0, options.limit)
      }

      return content
    } catch (error) {
      console.error("Error retrieving stored content:", error)
      return []
    }
  }

  // Analyze URL content
  static async analyzeUrl(url: string): Promise<ContentAnalysis> {
    try {
      console.log("Analyzing URL:", url)

      // Fetch content
      const response = await fetch("/api/content/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`)
      }

      const { content, title } = await response.json()

      // Analyze with Grok
      const analysisResponse = await fetch("/api/grok/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title, url }),
      })

      if (!analysisResponse.ok) {
        throw new Error(`Analysis failed: ${analysisResponse.statusText}`)
      }

      const analysis = await analysisResponse.json()

      // Store the analyzed content
      const storedContent: StoredContent = {
        id: Date.now().toString(),
        url,
        title: title || "Untitled",
        content,
        analysis,
        createdAt: new Date().toISOString(),
        source: "url-analysis",
      }

      this.storeContent(storedContent)

      return analysis
    } catch (error) {
      console.error("Error analyzing URL:", error)

      // Return fallback analysis
      return {
        summary: {
          sentence: "Content analysis failed - please try again",
          paragraph: "Unable to analyze this content at the moment. Please check the URL and try again.",
          isFullRead: false,
        },
        tags: ["error", "failed-analysis"],
        priority: "skim",
      }
    }
  }

  // Generate digest from content items
  static async generateDigest(
    timeframe: "weekly" | "monthly" | "quarterly",
    items: DigestItem[],
  ): Promise<GeneratedDigest> {
    try {
      console.log(`Generating ${timeframe} digest with ${items.length} items`)

      const response = await fetch("/api/grok/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe, items }),
      })

      if (!response.ok) {
        throw new Error(`Digest generation failed: ${response.statusText}`)
      }

      const digest = await response.json()
      return digest
    } catch (error) {
      console.error("Error generating digest:", error)

      // Return fallback digest
      return {
        timeframe,
        summary: `Unable to generate ${timeframe} digest at the moment. Please try again later.`,
        items: items.slice(0, 10), // Show first 10 items as fallback
        trendingConcepts: [],
        stats: {
          totalArticles: items.length,
          deepDiveCount: items.filter((i) => i.priority === "deep-dive").length,
          readCount: items.filter((i) => i.priority === "read").length,
          skimCount: items.filter((i) => i.priority === "skim").length,
          analyzedArticles: items.length,
        },
        generatedAt: new Date().toISOString(),
      }
    }
  }

  // Clear all stored content
  static clearStoredContent(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log("All stored content cleared")
    } catch (error) {
      console.error("Error clearing stored content:", error)
    }
  }

  // Get content statistics
  static getContentStats(): {
    totalItems: number
    byPriority: Record<string, number>
    byTimeframe: Record<string, number>
  } {
    try {
      const content = this.getStoredContent()
      const now = new Date()

      return {
        totalItems: content.length,
        byPriority: {
          "deep-dive": content.filter((c) => c.analysis.priority === "deep-dive").length,
          read: content.filter((c) => c.analysis.priority === "read").length,
          skim: content.filter((c) => c.analysis.priority === "skim").length,
        },
        byTimeframe: {
          "last-week": content.filter((c) => {
            const created = new Date(c.createdAt)
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return created >= weekAgo
          }).length,
          "last-month": content.filter((c) => {
            const created = new Date(c.createdAt)
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return created >= monthAgo
          }).length,
        },
      }
    } catch (error) {
      console.error("Error getting content stats:", error)
      return {
        totalItems: 0,
        byPriority: { "deep-dive": 0, read: 0, skim: 0 },
        byTimeframe: { "last-week": 0, "last-month": 0 },
      }
    }
  }
}

// Export individual functions for backward compatibility
export const analyzeUrl = ContentProcessor.analyzeUrl.bind(ContentProcessor)
export const generateDigest = ContentProcessor.generateDigest.bind(ContentProcessor)
export const getStoredContent = ContentProcessor.getStoredContent.bind(ContentProcessor)
export const storeContent = ContentProcessor.storeContent.bind(ContentProcessor)
