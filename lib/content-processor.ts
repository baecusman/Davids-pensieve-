// Clean content processor with NO processContent export

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

export class ContentProcessor {
  static async analyzeContent(params: {
    url?: string
    content?: string
    title?: string
  }): Promise<ContentAnalysis> {
    try {
      const response = await fetch("/api/grok/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`)
      }

      const analysis = await response.json()
      return analysis
    } catch (error) {
      console.error("Analysis error:", error)
      return {
        summary: {
          sentence: `Analysis of "${params.title || "Content"}"`,
          paragraph: "Content analysis summary",
          isFullRead: false,
        },
        entities: [{ name: "General Content", type: "concept" }],
        relationships: [],
        tags: ["analysis"],
        priority: "read" as const,
        fullContent: params.content,
        confidence: 0.5,
        source: params.url ? new URL(params.url).hostname : "manual",
        analyzedAt: new Date().toISOString(),
      }
    }
  }

  static async analyzeUrl(url: string): Promise<ContentAnalysis> {
    try {
      const contentResponse = await fetch("/api/content/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!contentResponse.ok) {
        throw new Error("Failed to fetch content")
      }

      const { content, title } = await contentResponse.json()
      return this.analyzeContent({ url, content, title })
    } catch (error) {
      console.error("Error analyzing URL:", error)
      throw error
    }
  }

  static getStoredContent(): any[] {
    try {
      const stored = localStorage.getItem("pensive_content")
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  static getContentStats() {
    const content = this.getStoredContent()
    return {
      totalItems: content.length,
      byPriority: {
        "deep-dive": content.filter((c: any) => c.analysis?.priority === "deep-dive").length,
        read: content.filter((c: any) => c.analysis?.priority === "read").length,
        skim: content.filter((c: any) => c.analysis?.priority === "skim").length,
      },
      byTimeframe: {
        "last-week": 0,
        "last-month": 0,
      },
    }
  }
}

// ONLY export what exists - NO processContent export
export const analyzeUrl = ContentProcessor.analyzeUrl.bind(ContentProcessor)
export const analyzeContent = ContentProcessor.analyzeContent.bind(ContentProcessor)
export const getStoredContent = ContentProcessor.getStoredContent.bind(ContentProcessor)
export const getContentStats = ContentProcessor.getContentStats.bind(ContentProcessor)
