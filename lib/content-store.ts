import { persistentStore } from "./persistent-store"

// Simple wrapper around persistent store for backward compatibility
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

class ContentStore {
  private static instance: ContentStore

  static getInstance(): ContentStore {
    if (!ContentStore.instance) {
      ContentStore.instance = new ContentStore()
    }
    return ContentStore.instance
  }

  store(content: Omit<StoredContent, "id" | "createdAt">): string {
    return persistentStore.store(content)
  }

  get(id: string): StoredContent | null {
    return persistentStore.get(id)
  }

  delete(id: string): boolean {
    return persistentStore.delete(id)
  }

  getAll(): StoredContent[] {
    return persistentStore.getAll()
  }

  getByTimeframe(timeframe: "weekly" | "monthly" | "quarterly"): StoredContent[] {
    return persistentStore.getByTimeframe(timeframe)
  }

  getByTags(tags: string[]): StoredContent[] {
    return persistentStore.getByTags(tags)
  }

  search(query: string): StoredContent[] {
    return persistentStore.search(query)
  }

  clear(): void {
    persistentStore.clear()
  }

  getCount(): number {
    return persistentStore.getCount()
  }
}

export const contentStore = ContentStore.getInstance()
