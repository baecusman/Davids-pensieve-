import { supabase } from "@/lib/database/supabase-client"
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

    const { data: feeds, error } = await supabase
      .from("feeds")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error getting user feeds:", error)
      return []
    }

    // Cache for 5 minutes
    memoryCache.set(cacheKey, feeds, 300)

    return feeds
  }

  async addFeed(
    userId: string,
    data: {
      url: string
      title: string
      description: string
    },
  ) {
    const { data: feed, error } = await supabase
      .from("feeds")
      .insert({
        user_id: userId,
        url: data.url,
        title: data.title,
        description: data.description,
        is_active: true,
        fetch_interval: 3600,
        item_count: 0,
        error_count: 0,
      })
      .select()
      .single()

    if (error) {
      console.error("Error adding feed:", error)
      throw new Error(`Failed to add feed: ${error.message}`)
    }

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return feed
  }

  async updateFeed(
    userId: string,
    feedId: string,
    data: {
      title?: string
      description?: string
      isActive?: boolean
      fetchInterval?: number
    },
  ) {
    const { data: feed, error } = await supabase
      .from("feeds")
      .update({
        title: data.title,
        description: data.description,
        is_active: data.isActive,
        fetch_interval: data.fetchInterval,
      })
      .eq("id", feedId)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error updating feed:", error)
      throw new Error(`Failed to update feed: ${error.message}`)
    }

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return feed
  }

  async deleteFeed(userId: string, feedId: string) {
    const { error } = await supabase.from("feeds").delete().eq("id", feedId).eq("user_id", userId)

    if (error) {
      console.error("Error deleting feed:", error)
      throw new Error(`Failed to delete feed: ${error.message}`)
    }

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return true
  }

  async fetchFeed(userId: string, feedId: string) {
    // In a real implementation, this would fetch the feed and process it
    // For now, we'll just update the last_fetched timestamp
    const { data: feed, error } = await supabase
      .from("feeds")
      .update({
        last_fetched: new Date().toISOString(),
      })
      .eq("id", feedId)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error fetching feed:", error)
      throw new Error(`Failed to fetch feed: ${error.message}`)
    }

    // Invalidate cache
    memoryCache.del(`user-feeds:${userId}`)

    return feed
  }
}

export const feedService = FeedService.getInstance()
