class CacheManager {
  private cache: Map<string, { data: any; expiry: number }> = new Map()

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    const expiry = Date.now() + ttlMs
    this.cache.set(key, { data, expiry })
  }

  get<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() > cached.expiry) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

export const cacheManager = new CacheManager()
