interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
  guid: string
}

interface RSSFeed {
  title: string
  description: string
  link: string
  items: RSSItem[]
}

interface StoredFeed {
  id: string
  url: string
  title: string
  description: string
  lastFetched: string
  lastItemDate: string
  isActive: boolean
  fetchInterval: number // minutes
  itemCount: number
  errorCount: number
  lastError?: string
}

class RSSProcessor {
  private static instance: RSSProcessor
  private feeds: Map<string, StoredFeed> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private storageKey = "pensive-rss-feeds"
  private processingQueue: Set<string> = new Set() // Track URLs being processed

  static getInstance(): RSSProcessor {
    if (!RSSProcessor.instance) {
      RSSProcessor.instance = new RSSProcessor()
    }
    return RSSProcessor.instance
  }

  constructor() {
    this.loadFeeds()
    this.startActiveFeeds()
  }

  private loadFeeds(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const feedsArray: StoredFeed[] = JSON.parse(stored)
        feedsArray.forEach((feed) => {
          this.feeds.set(feed.id, feed)
        })
        console.log(`Loaded ${feedsArray.length} RSS feeds`)
      }
    } catch (error) {
      console.error("Error loading RSS feeds:", error)
    }
  }

  private saveFeeds(): void {
    try {
      const feedsArray = Array.from(this.feeds.values())
      localStorage.setItem(this.storageKey, JSON.stringify(feedsArray))
    } catch (error) {
      console.error("Error saving RSS feeds:", error)
    }
  }

  private startActiveFeeds(): void {
    this.feeds.forEach((feed) => {
      if (feed.isActive) {
        this.startFeedMonitoring(feed.id)
      }
    })
  }

  async addFeed(url: string, fetchInterval = 60): Promise<{ success: boolean; feed?: StoredFeed; error?: string }> {
    try {
      console.log(`Adding RSS feed: ${url}`)

      // First, try to fetch and parse the feed
      const feedData = await this.fetchFeed(url)

      const feedId = `feed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const feed: StoredFeed = {
        id: feedId,
        url,
        title: feedData.title || "Unknown Feed",
        description: feedData.description || "",
        lastFetched: new Date().toISOString(),
        lastItemDate: feedData.items.length > 0 ? feedData.items[0].pubDate : new Date().toISOString(),
        isActive: true,
        fetchInterval,
        itemCount: feedData.items.length,
        errorCount: 0,
      }

      this.feeds.set(feedId, feed)
      this.saveFeeds()

      // Start monitoring
      this.startFeedMonitoring(feedId)

      // Process initial items (limit to prevent overwhelming)
      const recentItems = feedData.items.slice(0, 3) // Only process 3 most recent initially
      await this.processNewItems(feedId, recentItems)

      console.log(`Successfully added RSS feed: ${feed.title}`)
      return { success: true, feed }
    } catch (error) {
      console.error("Error adding RSS feed:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  private async fetchFeed(url: string): Promise<RSSFeed> {
    const response = await fetch("/api/rss/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`)
    }

    return response.json()
  }

  private startFeedMonitoring(feedId: string): void {
    const feed = this.feeds.get(feedId)
    if (!feed || !feed.isActive) return

    // Clear existing interval if any
    this.stopFeedMonitoring(feedId)

    const intervalMs = feed.fetchInterval * 60 * 1000 // Convert minutes to milliseconds
    const interval = setInterval(async () => {
      await this.checkFeedForUpdates(feedId)
    }, intervalMs)

    this.intervals.set(feedId, interval)
    console.log(`Started monitoring RSS feed: ${feed.title} (every ${feed.fetchInterval} minutes)`)
  }

  private stopFeedMonitoring(feedId: string): void {
    const interval = this.intervals.get(feedId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(feedId)
    }
  }

  private async checkFeedForUpdates(feedId: string): Promise<void> {
    const feed = this.feeds.get(feedId)
    if (!feed) return

    try {
      console.log(`Checking for updates: ${feed.title}`)
      const feedData = await this.fetchFeed(feed.url)

      // Find new items (items published after our last known item)
      const lastItemDate = new Date(feed.lastItemDate)
      const newItems = feedData.items.filter((item) => {
        const itemDate = new Date(item.pubDate)
        return itemDate > lastItemDate
      })

      if (newItems.length > 0) {
        console.log(`Found ${newItems.length} new items in ${feed.title}`)
        await this.processNewItems(feedId, newItems)

        // Update feed metadata
        feed.lastFetched = new Date().toISOString()
        feed.lastItemDate = newItems[0].pubDate // Most recent item
        feed.itemCount += newItems.length
        feed.errorCount = 0 // Reset error count on success

        this.feeds.set(feedId, feed)
        this.saveFeeds()

        // Trigger UI update event
        this.notifyUIUpdate(feedId, newItems.length)
      } else {
        // No new items, just update last fetched
        feed.lastFetched = new Date().toISOString()
        this.feeds.set(feedId, feed)
        this.saveFeeds()
      }
    } catch (error) {
      console.error(`Error checking feed ${feed.title}:`, error)

      // Update error count
      feed.errorCount = (feed.errorCount || 0) + 1
      feed.lastError = error instanceof Error ? error.message : "Unknown error"

      // Disable feed if too many errors
      if (feed.errorCount >= 5) {
        feed.isActive = false
        this.stopFeedMonitoring(feedId)
        console.warn(`Disabled RSS feed due to repeated errors: ${feed.title}`)
      }

      this.feeds.set(feedId, feed)
      this.saveFeeds()
    }
  }

  private async processNewItems(feedId: string, items: RSSItem[]): Promise<void> {
    const { ContentProcessor } = await import("./content-processor")

    for (const item of items) {
      // Skip if already processing this URL
      if (this.processingQueue.has(item.link)) {
        console.log(`Skipping ${item.title} - already processing`)
        continue
      }

      try {
        console.log(`Processing RSS item: ${item.title}`)
        this.processingQueue.add(item.link)

        // Analyze the article using the updated ContentProcessor
        await ContentProcessor.analyzeUrl(item.link)

        console.log(`Successfully processed: ${item.title}`)

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error) {
        console.error(`Error processing RSS item ${item.title}:`, error)
        // Continue with other items even if one fails
      } finally {
        this.processingQueue.delete(item.link)
      }
    }
  }

  private notifyUIUpdate(feedId: string, newItemCount: number): void {
    // Dispatch custom event for UI updates
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("rss-update", {
          detail: { feedId, newItemCount },
        }),
      )
    }
  }

  getFeeds(): StoredFeed[] {
    return Array.from(this.feeds.values()).sort(
      (a, b) => new Date(b.lastFetched).getTime() - new Date(a.lastFetched).getTime(),
    )
  }

  getFeed(feedId: string): StoredFeed | null {
    return this.feeds.get(feedId) || null
  }

  async toggleFeed(feedId: string): Promise<boolean> {
    const feed = this.feeds.get(feedId)
    if (!feed) return false

    feed.isActive = !feed.isActive

    if (feed.isActive) {
      this.startFeedMonitoring(feedId)
    } else {
      this.stopFeedMonitoring(feedId)
    }

    this.feeds.set(feedId, feed)
    this.saveFeeds()

    return feed.isActive
  }

  async updateFeedInterval(feedId: string, intervalMinutes: number): Promise<boolean> {
    const feed = this.feeds.get(feedId)
    if (!feed) return false

    feed.fetchInterval = intervalMinutes

    // Restart monitoring with new interval
    if (feed.isActive) {
      this.stopFeedMonitoring(feedId)
      this.startFeedMonitoring(feedId)
    }

    this.feeds.set(feedId, feed)
    this.saveFeeds()

    return true
  }

  async removeFeed(feedId: string): Promise<boolean> {
    const feed = this.feeds.get(feedId)
    if (!feed) return false

    this.stopFeedMonitoring(feedId)
    this.feeds.delete(feedId)
    this.saveFeeds()

    console.log(`Removed RSS feed: ${feed.title}`)
    return true
  }

  async testFeed(url: string): Promise<{ success: boolean; feed?: RSSFeed; error?: string }> {
    try {
      const feedData = await this.fetchFeed(url)
      return { success: true, feed: feedData }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  // Get processing status
  getProcessingStatus(): { activeFeeds: number; processingUrls: number; totalItems: number } {
    const activeFeeds = Array.from(this.feeds.values()).filter((f) => f.isActive).length
    const totalItems = Array.from(this.feeds.values()).reduce((sum, f) => sum + f.itemCount, 0)

    return {
      activeFeeds,
      processingUrls: this.processingQueue.size,
      totalItems,
    }
  }

  // Cleanup method
  destroy(): void {
    this.intervals.forEach((interval) => {
      clearInterval(interval)
    })
    this.intervals.clear()
  }
}

export const rssProcessor = RSSProcessor.getInstance()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    rssProcessor.destroy()
  })
}
