interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  hits: number
}

class CacheManager {
  private static instance: CacheManager
  private cache: Map<string, CacheEntry<any>> = new Map()
  private maxSize = 100
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    // Evict expired entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictExpired()
      if (this.cache.size >= this.maxSize) {
        this.evictLRU()
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    // Update hit count
    entry.hits++
    return entry.data as T
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  private evictLRU(): void {
    let lruKey = ""
    let lruHits = Number.POSITIVE_INFINITY

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < lruHits) {
        lruHits = entry.hits
        lruKey = key
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }

  getStats(): { size: number; hitRate: number; memoryUsage: number } {
    let totalHits = 0
    let totalRequests = 0

    for (const entry of this.cache.values()) {
      totalHits += entry.hits
      totalRequests += entry.hits + 1 // +1 for initial set
    }

    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      memoryUsage: this.cache.size * 0.001, // Rough estimate in MB
    }
  }
}

export const cacheManager = CacheManager.getInstance()
