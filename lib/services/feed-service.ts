import { mockDb } from "@/lib/database/mock-db"
import { memoryCache } from "@/lib/cache/memory-cache"

export class FeedService {
  private static instance: FeedService

  static getInstance(): FeedService {
    if (!FeedService.instance) {
      FeedService.instance = new FeedService()
    }
    return FeedService.instance
  }

  async getUserFeeds(userId: string) {
    const cacheKey = `user-feeds:${userId}`
    const cached = memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    const feeds = await mockDb.getFeeds(userId)

    // Cache for 5 minutes
    memoryCache.set(cacheKey, feeds, 300)

    return feeds
  }

  async addFeed(
    userId: string,
    data: {
      url: string
      name: string
      type?: string
    },
  ) {
    const feed = await mockDb.createFeed({
      userId,
      url: data.url,
      name: data.name,
      type: data.type || "RSS",
      isActive: true,
    })

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return feed
  }

  async updateFeed(
    userId: string,
    feedId: string,
    data: {
      name?: string
      url?: string
      isActive?: boolean
      type?: string
    },
  ) {
    const feed = await mockDb.updateFeed(feedId, data)

    if (!feed) {
      throw new Error("Feed not found")
    }

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return feed
  }

  async deleteFeed(userId: string, feedId: string) {
    const success = await mockDb.deleteFeed(feedId)

    if (!success) {
      throw new Error("Failed to delete feed")
    }

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return true
  }

  async fetchFeed(userId: string, feedId: string) {
    // In a real implementation, this would fetch the feed and process it
    // For now, we'll just update the last_fetched timestamp
    const feed = await mockDb.updateFeed(feedId, {
      lastFetched: new Date().toISOString(),
    })

    if (!feed) {
      throw new Error("Feed not found")
    }

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return feed
  }
}

export const feedService = FeedService.getInstance()
