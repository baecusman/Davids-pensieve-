interface CacheItem<T> {
  value: T
  expiry: number
}

export class MemoryCache {
  private static instance: MemoryCache
  private cache = new Map<string, CacheItem<any>>()
  private cleanupInterval: NodeJS.Timeout

  private constructor() {
    // Clean up expired items every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup()
      },
      5 * 60 * 1000,
    )
  }

  static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache()
    }
    return MemoryCache.instance
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value as T
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<boolean> {
    try {
      const expiry = Date.now() + ttlSeconds * 1000
      this.cache.set(key, { value, expiry })
      return true
    } catch (error) {
      console.error("Memory cache set error:", error)
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    return this.cache.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key)
    if (!item) return false

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  async getJSON<T>(key: string): Promise<T | null> {
    return this.get<T>(key)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
  }

  // Generate cache keys (same as Redis version)
  static keys = {
    grokAnalysis: (contentHash: string) => `grok:analysis:${contentHash}`,
    rssFeed: (feedUrl: string) => `rss:feed:${Buffer.from(feedUrl).toString("base64")}`,
    userContent: (userId: string, page: number) => `user:content:${userId}:${page}`,
    conceptMap: (userId: string, abstractionLevel: number) => `concept:map:${userId}:${abstractionLevel}`,
  }

  // Get cache stats for monitoring
  getStats() {
    const now = Date.now()
    let validItems = 0
    let expiredItems = 0

    for (const [, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expiredItems++
      } else {
        validItems++
      }
    }

    return {
      totalItems: this.cache.size,
      validItems,
      expiredItems,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
    }
  }
}

export const memoryCache = MemoryCache.getInstance()
