class MemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>()

  set(key: string, value: any, ttlSeconds = 300): void {
    const expiry = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiry })
  }

  get<T = any>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  getJSON<T = any>(key: string): T | null {
    return this.get<T>(key)
  }

  del(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

export const memoryCache = new MemoryCache()

// Clean up expired entries every 5 minutes
if (typeof window !== "undefined") {
  setInterval(
    () => {
      memoryCache.cleanup()
    },
    5 * 60 * 1000,
  )
}
