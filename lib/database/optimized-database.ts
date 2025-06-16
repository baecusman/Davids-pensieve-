interface StoredContent {
  id: string
  title: string
  url: string
  content: string
  source: string
  createdAt: string
  analysis: any
}

export class OptimizedDatabase {
  private content: Map<string, StoredContent> = new Map()
  private initialized = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    if (this.initialized) return

    try {
      // Try to load from localStorage if available
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = localStorage.getItem("pensive-content")
        if (stored) {
          const data = JSON.parse(stored)
          if (Array.isArray(data)) {
            data.forEach((item) => {
              this.content.set(item.id, item)
            })
          }
        }
      }
    } catch (error) {
      console.error("Error initializing database:", error)
    }

    this.initialized = true
  }

  private persist() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const data = Array.from(this.content.values())
        localStorage.setItem("pensive-content", JSON.stringify(data))
      }
    } catch (error) {
      console.error("Error persisting database:", error)
    }
  }

  storeContent(content: StoredContent): void {
    this.content.set(content.id, content)
    this.persist()
  }

  getAllContent(): StoredContent[] {
    return Array.from(this.content.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  getContent(id: string): StoredContent | undefined {
    return this.content.get(id)
  }

  deleteContent(id: string): boolean {
    const deleted = this.content.delete(id)
    if (deleted) {
      this.persist()
    }
    return deleted
  }

  clear(): void {
    this.content.clear()
    this.persist()
  }

  getSize(): number {
    return this.content.size
  }
}
