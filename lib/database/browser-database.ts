interface StoredContent {
  id: string
  userId: string
  title: string
  url: string
  content: string
  source: string
  createdAt: string
  updatedAt: string
}

interface StoredAnalysis {
  id: string
  userId: string
  contentId: string
  summary: any
  concepts: any[]
  priority: string
  tags: string[]
  createdAt: string
}

class BrowserDatabase {
  private static instance: BrowserDatabase
  private contentKey = "pensive-content-v2"
  private analysisKey = "pensive-analysis-v2"
  private conceptsKey = "pensive-concepts-v2"

  static getInstance(): BrowserDatabase {
    if (!BrowserDatabase.instance) {
      BrowserDatabase.instance = new BrowserDatabase()
    }
    return BrowserDatabase.instance
  }

  // Content operations
  storeContent(content: any): boolean {
    try {
      const stored = this.getAllContent()
      const contentWithId = {
        ...content,
        id: content.id || this.generateId(),
        createdAt: content.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      stored.push(contentWithId)
      localStorage.setItem(this.contentKey, JSON.stringify(stored))
      return true
    } catch (error) {
      console.error("Error storing content:", error)
      return false
    }
  }

  getAllContent(): StoredContent[] {
    try {
      const stored = localStorage.getItem(this.contentKey)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error getting all content:", error)
      return []
    }
  }

  getUserContent(userId: string): StoredContent[] {
    try {
      const allContent = this.getAllContent()
      return allContent.filter((content) => content.userId === userId)
    } catch (error) {
      console.error("Error getting user content:", error)
      return []
    }
  }

  // Analysis operations
  storeAnalysis(analysis: any): boolean {
    try {
      const stored = this.getAllAnalyses()
      const analysisWithId = {
        ...analysis,
        id: analysis.id || this.generateId(),
        createdAt: analysis.createdAt || new Date().toISOString(),
      }

      stored.push(analysisWithId)
      localStorage.setItem(this.analysisKey, JSON.stringify(stored))
      return true
    } catch (error) {
      console.error("Error storing analysis:", error)
      return false
    }
  }

  getAllAnalyses(): StoredAnalysis[] {
    try {
      const stored = localStorage.getItem(this.analysisKey)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error getting all analyses:", error)
      return []
    }
  }

  getUserAnalyses(userId: string): StoredAnalysis[] {
    try {
      const allAnalyses = this.getAllAnalyses()
      return allAnalyses.filter((analysis) => analysis.userId === userId)
    } catch (error) {
      console.error("Error getting user analyses:", error)
      return []
    }
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Database stats
  getStats(): any {
    try {
      const allContent = this.getAllContent()
      const allAnalyses = this.getAllAnalyses()

      return {
        totalContent: allContent.length,
        totalAnalyses: allAnalyses.length,
        users: [...new Set(allContent.map((c) => c.userId))].length,
      }
    } catch (error) {
      console.error("Error getting database stats:", error)
      return {
        totalContent: 0,
        totalAnalyses: 0,
        users: 0,
      }
    }
  }

  // Clear all data
  clear(): boolean {
    try {
      localStorage.removeItem(this.contentKey)
      localStorage.removeItem(this.analysisKey)
      localStorage.removeItem(this.conceptsKey)
      return true
    } catch (error) {
      console.error("Error clearing database:", error)
      return false
    }
  }
}

export const browserDatabase = BrowserDatabase.getInstance()
export { BrowserDatabase }
