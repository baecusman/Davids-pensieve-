interface PodcastSubscription {
  id: string
  title: string
  description: string
  url: string
  platform: "spotify" | "apple" | "rss"
  isActive: boolean
  createdAt: string
  lastChecked: string
  episodeCount: number
  errorCount: number
  lastError?: string
}

interface PodcastEpisode {
  id: string
  title: string
  description: string
  url: string
  publishedAt: string
  duration: number
  transcript?: string
  showTitle: string
}

class PodcastProcessor {
  private static instance: PodcastProcessor
  private subscriptions: Map<string, PodcastSubscription> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private storageKey = "pensive-podcast-subscriptions"
  private processingQueue: Set<string> = new Set()

  static getInstance(): PodcastProcessor {
    if (!PodcastProcessor.instance) {
      PodcastProcessor.instance = new PodcastProcessor()
    }
    return PodcastProcessor.instance
  }

  constructor() {
    this.loadSubscriptions()
    this.startActiveSubscriptions()
  }

  private loadSubscriptions(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const subscriptionsArray: PodcastSubscription[] = JSON.parse(stored)
        subscriptionsArray.forEach((subscription) => {
          this.subscriptions.set(subscription.id, subscription)
        })
        console.log(`Loaded ${subscriptionsArray.length} podcast subscriptions`)
      }
    } catch (error) {
      console.error("Error loading podcast subscriptions:", error)
    }
  }

  private saveSubscriptions(): void {
    try {
      const subscriptionsArray = Array.from(this.subscriptions.values())
      localStorage.setItem(this.storageKey, JSON.stringify(subscriptionsArray))
    } catch (error) {
      console.error("Error saving podcast subscriptions:", error)
    }
  }

  private startActiveSubscriptions(): void {
    this.subscriptions.forEach((subscription) => {
      if (subscription.isActive) {
        this.startSubscriptionMonitoring(subscription.id)
      }
    })
  }

  async processEpisode(url: string): Promise<any> {
    try {
      console.log(`Processing podcast episode: ${url}`)

      // Determine platform and extract episode info
      const episodeInfo = await this.extractEpisodeInfo(url)

      // Get transcript if available
      const transcript = await this.getEpisodeTranscript(episodeInfo)

      if (!transcript) {
        throw new Error("No transcript available for this episode")
      }

      // Import ContentProcessor dynamically
      const { ContentProcessor } = await import("./content-processor")

      // Analyze the transcript
      const analysis = await ContentProcessor.analyzeContent({
        title: `${episodeInfo.showTitle}: ${episodeInfo.title}`,
        content: transcript,
        url: url,
      })

      console.log(`Successfully processed podcast episode: ${episodeInfo.title}`)
      return analysis
    } catch (error) {
      console.error("Error processing podcast episode:", error)
      throw error
    }
  }

  async addSubscription(url: string): Promise<{ success: boolean; podcast?: PodcastSubscription; error?: string }> {
    try {
      console.log(`Adding podcast subscription: ${url}`)

      // Extract show info from URL
      const showInfo = await this.extractShowInfo(url)

      // Check if subscription already exists
      const existingSubscription = Array.from(this.subscriptions.values()).find((sub) => sub.url === url)
      if (existingSubscription) {
        return { success: false, error: "Podcast already subscribed" }
      }

      const subscriptionId = `podcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const subscription: PodcastSubscription = {
        id: subscriptionId,
        title: showInfo.title,
        description: showInfo.description,
        url: url,
        platform: this.detectPlatform(url),
        isActive: true,
        createdAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
        episodeCount: 0,
        errorCount: 0,
      }

      this.subscriptions.set(subscriptionId, subscription)
      this.saveSubscriptions()

      // Start monitoring
      this.startSubscriptionMonitoring(subscriptionId)

      console.log(`Successfully added podcast subscription: ${showInfo.title}`)
      return { success: true, podcast: subscription }
    } catch (error) {
      console.error("Error adding podcast subscription:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  private async extractEpisodeInfo(url: string): Promise<PodcastEpisode> {
    // In a real implementation, you would:
    // 1. Use Spotify Web API or Apple Podcasts API
    // 2. Extract episode metadata
    // 3. Get official transcript if available

    // For now, return mock data
    const episodeId = this.extractIdFromUrl(url)
    return {
      id: episodeId,
      title: "Sample Podcast Episode",
      description: "This is a sample podcast episode description",
      url: url,
      publishedAt: new Date().toISOString(),
      duration: 3600, // 1 hour in seconds
      showTitle: "Sample Podcast Show",
    }
  }

  private async extractShowInfo(url: string): Promise<{ title: string; description: string }> {
    // In a real implementation, you would extract show metadata from the platform
    return {
      title: "Sample Podcast Show",
      description: "This is a sample podcast show description",
    }
  }

  private async getEpisodeTranscript(episode: PodcastEpisode): Promise<string | null> {
    try {
      // In a real implementation, you would:
      // 1. Check if official transcript is available from the platform
      // 2. Use speech-to-text service if no official transcript
      // 3. Return the transcript text

      // For now, return a sample transcript
      return `This is a sample transcript for the podcast episode "${episode.title}". 
      In a real implementation, this would contain the actual spoken content from the podcast episode.
      The transcript would be processed and analyzed for concepts, entities, and relationships.
      This allows podcast content to be included in your knowledge base alongside articles and other sources.`
    } catch (error) {
      console.error("Error getting episode transcript:", error)
      return null
    }
  }

  private detectPlatform(url: string): "spotify" | "apple" | "rss" {
    if (url.includes("spotify.com")) return "spotify"
    if (url.includes("podcasts.apple.com")) return "apple"
    return "rss"
  }

  private extractIdFromUrl(url: string): string {
    // Extract episode/show ID from URL
    const match = url.match(/\/([a-zA-Z0-9]+)(?:\?|$)/)
    return match ? match[1] : `id_${Date.now()}`
  }

  private startSubscriptionMonitoring(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription || !subscription.isActive) return

    // Clear existing interval if any
    this.stopSubscriptionMonitoring(subscriptionId)

    // Check for new episodes every 6 hours
    const intervalMs = 6 * 60 * 60 * 1000
    const interval = setInterval(async () => {
      await this.checkSubscriptionForUpdates(subscriptionId)
    }, intervalMs)

    this.intervals.set(subscriptionId, interval)
    console.log(`Started monitoring podcast subscription: ${subscription.title}`)
  }

  private stopSubscriptionMonitoring(subscriptionId: string): void {
    const interval = this.intervals.get(subscriptionId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(subscriptionId)
    }
  }

  private async checkSubscriptionForUpdates(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return

    try {
      console.log(`Checking for new episodes: ${subscription.title}`)

      // In a real implementation, you would:
      // 1. Fetch latest episodes from the platform
      // 2. Compare with last checked date
      // 3. Process new episodes

      // For now, simulate finding new episodes occasionally
      const hasNewEpisodes = Math.random() > 0.8 // 20% chance of new episodes

      if (hasNewEpisodes) {
        const newEpisodeCount = Math.floor(Math.random() * 2) + 1
        console.log(`Found ${newEpisodeCount} new episodes from ${subscription.title}`)

        // Simulate processing episodes
        for (let i = 0; i < newEpisodeCount; i++) {
          const episodeUrl = `${subscription.url}/episode_${Date.now()}_${i}`
          await this.processEpisode(episodeUrl)
        }

        // Update subscription metadata
        subscription.lastChecked = new Date().toISOString()
        subscription.episodeCount += newEpisodeCount
        subscription.errorCount = 0

        this.subscriptions.set(subscriptionId, subscription)
        this.saveSubscriptions()

        // Trigger UI update event
        this.notifyUIUpdate(subscriptionId, newEpisodeCount)
      } else {
        // No new episodes, just update last checked
        subscription.lastChecked = new Date().toISOString()
        this.subscriptions.set(subscriptionId, subscription)
        this.saveSubscriptions()
      }
    } catch (error) {
      console.error(`Error checking podcast subscription ${subscription.title}:`, error)

      // Update error count
      subscription.errorCount = (subscription.errorCount || 0) + 1
      subscription.lastError = error instanceof Error ? error.message : "Unknown error"

      // Disable subscription if too many errors
      if (subscription.errorCount >= 5) {
        subscription.isActive = false
        this.stopSubscriptionMonitoring(subscriptionId)
        console.warn(`Disabled podcast subscription due to repeated errors: ${subscription.title}`)
      }

      this.subscriptions.set(subscriptionId, subscription)
      this.saveSubscriptions()
    }
  }

  private notifyUIUpdate(subscriptionId: string, newEpisodeCount: number): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("podcast-update", {
          detail: { subscriptionId, newEpisodeCount },
        }),
      )
    }
  }

  getSubscriptions(): PodcastSubscription[] {
    return Array.from(this.subscriptions.values()).sort(
      (a, b) => new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime(),
    )
  }

  getSubscription(subscriptionId: string): PodcastSubscription | null {
    return this.subscriptions.get(subscriptionId) || null
  }

  async toggleSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    subscription.isActive = !subscription.isActive

    if (subscription.isActive) {
      this.startSubscriptionMonitoring(subscriptionId)
    } else {
      this.stopSubscriptionMonitoring(subscriptionId)
    }

    this.subscriptions.set(subscriptionId, subscription)
    this.saveSubscriptions()

    return subscription.isActive
  }

  async removeSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    this.stopSubscriptionMonitoring(subscriptionId)
    this.subscriptions.delete(subscriptionId)
    this.saveSubscriptions()

    console.log(`Removed podcast subscription: ${subscription.title}`)
    return true
  }

  // Get processing status
  getProcessingStatus(): { activeSubscriptions: number; processingEpisodes: number; totalEpisodes: number } {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter((s) => s.isActive).length
    const totalEpisodes = Array.from(this.subscriptions.values()).reduce((sum, s) => sum + s.episodeCount, 0)

    return {
      activeSubscriptions,
      processingEpisodes: this.processingQueue.size,
      totalEpisodes,
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

export const podcastProcessor = PodcastProcessor.getInstance()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    podcastProcessor.destroy()
  })
}
