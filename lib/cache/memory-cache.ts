/**
 * Simple in-memory cache implementation
 */
class MemoryCache {
  private cache: Map<string, { value: any; expires: number }> = new Map()

  /**
   * Set a value in the cache with optional expiration in seconds
   */
  set(key: string, value: any, ttl = 300): void {
    const expires = Date.now() + ttl * 1000
    this.cache.set(key, { value, expires })
  }

  /**
   * Get a value from the cache
   */
  get(key: string): any {
    const item = this.cache.get(key)

    if (!item) return null

    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  /**
   * Get and parse JSON value from cache
   */
  getJSON<T>(key: string): T | null {
    const value = this.get(key)
    return value ? value : null
  }

  /**
   * Delete a value from the cache
   */
  del(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

export const memoryCache = new MemoryCache()
