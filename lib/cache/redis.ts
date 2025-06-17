import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export class CacheService {
  private static instance: CacheService

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      return value as T
    } catch (error) {
      console.error("Cache get error:", error)
      return null
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, JSON.stringify(value))
      } else {
        await redis.set(key, JSON.stringify(value))
      }
      return true
    } catch (error) {
      console.error("Cache set error:", error)
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await redis.del(key)
      return true
    } catch (error) {
      console.error("Cache delete error:", error)
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key)
      return result === 1
    } catch (error) {
      console.error("Cache exists error:", error)
      return false
    }
  }

  // Cache with automatic JSON parsing
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      if (!value) return null
      return typeof value === "string" ? JSON.parse(value) : value
    } catch (error) {
      console.error("Cache getJSON error:", error)
      return null
    }
  }

  // Generate cache keys
  static keys = {
    grokAnalysis: (contentHash: string) => `grok:analysis:${contentHash}`,
    rssFeed: (feedUrl: string) => `rss:feed:${Buffer.from(feedUrl).toString("base64")}`,
    userContent: (userId: string, page: number) => `user:content:${userId}:${page}`,
    conceptMap: (userId: string, abstractionLevel: number) => `concept:map:${userId}:${abstractionLevel}`,
  }
}

export const cacheService = CacheService.getInstance()
