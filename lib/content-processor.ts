// CLEAN content processor - NO processContent function exists or is exported

export interface ContentAnalysis {
  summary: {
    sentence: string
    paragraph: string
    isFullRead: boolean
  }
  tags: string[]
  priority: "skim" | "read" | "deep-dive"
  fullContent?: string
  analyzedAt: string
  source: string
}

export class ContentProcessor {
  static async analyzeUrl(url: string): Promise<ContentAnalysis> {
    try {
      const response = await fetch("/api/content/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch content")
      }

      const { content, title } = await response.json()

      const analysisResponse = await fetch("/api/grok/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title, url }),
      })

      if (!analysisResponse.ok) {
        throw new Error("Analysis failed")
      }

      return await analysisResponse.json()
    } catch (error) {
      console.error("Error analyzing URL:", error)
      return {
        summary: {
          sentence: "Analysis failed",
          paragraph: "Unable to analyze this content",
          isFullRead: false,
        },
        tags: ["error"],
        priority: "skim",
        analyzedAt: new Date().toISOString(),
        source: "error",
      }
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
}

// ONLY export what actually exists
export const analyzeUrl = ContentProcessor.analyzeUrl.bind(ContentProcessor)
export const getStoredContent = ContentProcessor.getStoredContent.bind(ContentProcessor)

// DO NOT EXPORT processContent - it does not exist
