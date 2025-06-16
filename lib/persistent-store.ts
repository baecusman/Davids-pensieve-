// Persistent storage layer using localStorage with fallback to memory
interface StoredContent {
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
    priority: "skim" | "read" | "deep-dive"
    fullContent?: string
  }
  createdAt: string
  source: string
}

interface AppSettings {
  lastSync: string
  version: string
  preferences: {
    defaultAbstractionLevel: number
    autoAnalyze: boolean
  }
}

class PersistentStore {
  private static instance: PersistentStore
  private storageKey = "pensive-content"
  private settingsKey = "pensive-settings"
  private memoryFallback: Map<string, StoredContent> = new Map()
  private isLocalStorageAvailable: boolean

  constructor() {
    this.isLocalStorageAvailable = this.checkLocalStorage()
    this.migrateOldData()
  }

  static getInstance(): PersistentStore {
    if (!PersistentStore.instance) {
      PersistentStore.instance = new PersistentStore()
    }
    return PersistentStore.instance
  }

  private checkLocalStorage(): boolean {
    try {
      const test = "__localStorage_test__"
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      console.warn("localStorage not available, using memory fallback")
      return false
    }
  }

  private migrateOldData(): void {
    // Migration logic for future schema changes
    try {
      const stored = this.getAllStored()
      if (stored.length > 0) {
        console.log(`Loaded ${stored.length} items from persistent storage`)
      }
    } catch (error) {
      console.error("Error during data migration:", error)
    }
  }

  store(content: Omit<StoredContent, "id" | "createdAt">): string {
    const id = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const storedContent: StoredContent = {
      ...content,
      id,
      createdAt: new Date().toISOString(),
    }

    try {
      if (this.isLocalStorageAvailable) {
        const existing = this.getAllStored()
        existing.push(storedContent)
        localStorage.setItem(this.storageKey, JSON.stringify(existing))
        console.log(`Stored content with ID: ${id} (localStorage)`)
      } else {
        this.memoryFallback.set(id, storedContent)
        console.log(`Stored content with ID: ${id} (memory fallback)`)
      }
    } catch (error) {
      console.error("Error storing content:", error)
      // Fallback to memory
      this.memoryFallback.set(id, storedContent)
    }

    return id
  }

  get(id: string): StoredContent | null {
    try {
      if (this.isLocalStorageAvailable) {
        const stored = this.getAllStored()
        return stored.find((item) => item.id === id) || null
      } else {
        return this.memoryFallback.get(id) || null
      }
    } catch (error) {
      console.error("Error retrieving content:", error)
      return this.memoryFallback.get(id) || null
    }
  }

  delete(id: string): boolean {
    try {
      if (this.isLocalStorageAvailable) {
        const stored = this.getAllStored()
        const filtered = stored.filter((item) => item.id !== id)
        localStorage.setItem(this.storageKey, JSON.stringify(filtered))
        console.log(`Deleted content with ID: ${id} (localStorage)`)
        return true
      } else {
        const result = this.memoryFallback.delete(id)
        console.log(`Deleted content with ID: ${id} (memory fallback)`)
        return result
      }
    } catch (error) {
      console.error("Error deleting content:", error)
      return this.memoryFallback.delete(id)
    }
  }

  getAll(): StoredContent[] {
    try {
      if (this.isLocalStorageAvailable) {
        return this.getAllStored().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      } else {
        return Array.from(this.memoryFallback.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      }
    } catch (error) {
      console.error("Error retrieving all content:", error)
      return Array.from(this.memoryFallback.values())
    }
  }

  private getAllStored(): StoredContent[] {
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error parsing stored content:", error)
      return []
    }
  }

  getByTimeframe(timeframe: "weekly" | "monthly" | "quarterly"): StoredContent[] {
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

    return this.getAll().filter((content) => new Date(content.createdAt) >= cutoffDate)
  }

  getByTags(tags: string[]): StoredContent[] {
    return this.getAll().filter((content) => tags.some((tag) => content.analysis.tags.includes(tag)))
  }

  search(query: string): StoredContent[] {
    const lowerQuery = query.toLowerCase()
    return this.getAll().filter(
      (content) =>
        content.title.toLowerCase().includes(lowerQuery) ||
        content.analysis.summary.sentence.toLowerCase().includes(lowerQuery) ||
        content.analysis.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    )
  }

  clear(): void {
    try {
      if (this.isLocalStorageAvailable) {
        localStorage.removeItem(this.storageKey)
        console.log("Cleared all content (localStorage)")
      }
      this.memoryFallback.clear()
      console.log("Cleared all content (memory)")
    } catch (error) {
      console.error("Error clearing content:", error)
      this.memoryFallback.clear()
    }
  }

  getCount(): number {
    return this.getAll().length
  }

  // Settings management
  getSettings(): AppSettings {
    try {
      if (this.isLocalStorageAvailable) {
        const stored = localStorage.getItem(this.settingsKey)
        if (stored) {
          return JSON.parse(stored)
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error)
    }

    // Default settings
    return {
      lastSync: new Date().toISOString(),
      version: "1.0.0",
      preferences: {
        defaultAbstractionLevel: 30,
        autoAnalyze: true,
      },
    }
  }

  saveSettings(settings: AppSettings): void {
    try {
      if (this.isLocalStorageAvailable) {
        localStorage.setItem(this.settingsKey, JSON.stringify(settings))
        console.log("Settings saved")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
    }
  }

  // Export/Import functionality
  exportData(): { content: StoredContent[]; settings: AppSettings; exportedAt: string } {
    return {
      content: this.getAll(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString(),
    }
  }

  importData(data: { content: StoredContent[]; settings?: AppSettings }): { success: boolean; imported: number } {
    try {
      // Clear existing data
      this.clear()

      // Import content
      let imported = 0
      data.content.forEach((item) => {
        try {
          this.store({
            title: item.title,
            url: item.url,
            content: item.content,
            analysis: item.analysis,
            source: item.source,
          })
          imported++
        } catch (error) {
          console.error("Error importing item:", error)
        }
      })

      // Import settings if provided
      if (data.settings) {
        this.saveSettings(data.settings)
      }

      console.log(`Successfully imported ${imported} items`)
      return { success: true, imported }
    } catch (error) {
      console.error("Error during import:", error)
      return { success: false, imported: 0 }
    }
  }

  // Storage info
  getStorageInfo(): {
    isLocalStorageAvailable: boolean
    itemCount: number
    estimatedSize: string
    lastModified: string | null
  } {
    const items = this.getAll()
    const estimatedSize = this.isLocalStorageAvailable
      ? `${Math.round((localStorage.getItem(this.storageKey)?.length || 0) / 1024)}KB`
      : "Memory only"

    const lastModified = items.length > 0 ? items[0].createdAt : null

    return {
      isLocalStorageAvailable: this.isLocalStorageAvailable,
      itemCount: items.length,
      estimatedSize,
      lastModified,
    }
  }
}

export const persistentStore = PersistentStore.getInstance()
