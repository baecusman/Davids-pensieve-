interface CacheItem {
  value: any
  expiresAt: number
}

class MemoryCache {
  private cache = new Map<string, CacheItem>()

  keys = {
    grokAnalysis: (hash: string) => `grok:${hash}`,
    rssFeed: (url: string) => `rss:${Buffer.from(url).toString("base64")}`,
    userContent: (userId: string) => `user:${userId}:content`,
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiresAt })

    // Clean up expired items periodically
    if (Math.random() < 0.01) {
      // 1% chance
      this.cleanup()
    }
  }

  async get(key: string): Promise<any> {
    const item = this.cache.get(key)

    if (!item) return null

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  async getJSON(key: string): Promise<any> {
    return this.get(key)
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

export const memoryCache = new MemoryCache()
