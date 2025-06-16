interface PodcastSubscription {
  id: string
  title: string
  description: string
  url: string
  platform: "spotify" | "apple" | "rss" | "youtube"
  isActive: boolean
  createdAt: string
  lastChecked: string
  episodeCount: number
  errorCount: number
  lastError?: string
  rssUrl?: string // For RSS-based podcasts
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
  audioUrl?: string
}

class RealPodcastProcessor {
  private static instance: RealPodcastProcessor
  private subscriptions: Map<string, PodcastSubscription> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private storageKey = "pensive-podcast-subscriptions-real"
  private processingQueue: Set<string> = new Set()

  static getInstance(): RealPodcastProcessor {
    if (!RealPodcastProcessor.instance) {
      RealPodcastProcessor.instance = new RealPodcastProcessor()
    }
    return RealPodcastProcessor.instance
  }

  constructor() {
    this.loadSubscriptions()
    this.startActiveSubscriptions()
  }

  async processEpisode(url: string): Promise<any> {
    try {
      console.log(`Processing podcast episode: ${url}`)

      // Detect platform and extract episode info
      const platform = this.detectPlatform(url)
      let episodeInfo: PodcastEpisode

      switch (platform) {
        case "spotify":
          episodeInfo = await this.processSpotifyEpisode(url)
          break
        case "apple":
          episodeInfo = await this.processAppleEpisode(url)
          break
        case "youtube":
          episodeInfo = await this.processYouTubeEpisode(url)
          break
        case "rss":
          episodeInfo = await this.processRSSEpisode(url)
          break
        default:
          throw new Error(`Unsupported platform for URL: ${url}`)
      }

      // Get transcript
      const transcript = await this.getEpisodeTranscript(episodeInfo)

      if (!transcript) {
        throw new Error("Could not extract transcript from episode")
      }

      // Import ContentProcessor and analyze
      const { ContentProcessor } = await import("./content-processor")

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

  private async processSpotifyEpisode(url: string): Promise<PodcastEpisode> {
    try {
      // Extract Spotify episode ID from URL
      const episodeId = this.extractSpotifyId(url)

      // For now, we'll extract metadata from the page since Spotify API requires auth
      const response = await fetch(`/api/podcast/spotify?url=${encodeURIComponent(url)}`)

      if (!response.ok) {
        // Fallback: try to extract from page HTML
        return await this.extractFromSpotifyPage(url)
      }

      const data = await response.json()
      return {
        id: episodeId,
        title: data.title || "Unknown Episode",
        description: data.description || "",
        url: url,
        publishedAt: data.publishedAt || new Date().toISOString(),
        duration: data.duration || 0,
        showTitle: data.showTitle || "Unknown Show",
        audioUrl: data.audioUrl,
      }
    } catch (error) {
      console.error("Error processing Spotify episode:", error)
      throw new Error("Failed to process Spotify episode")
    }
  }

  private async extractFromSpotifyPage(url: string): Promise<PodcastEpisode> {
    try {
      // Use a CORS proxy or our own API endpoint to fetch the page
      const response = await fetch(`/api/podcast/extract?url=${encodeURIComponent(url)}`)
      const html = await response.text()

      // Parse HTML to extract metadata
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, "text/html")

      // Extract Open Graph and meta tags
      const title =
        doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        doc.querySelector("title")?.textContent ||
        "Unknown Episode"

      const description =
        doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
        doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
        ""

      const showTitle = title.split(":")[0] || "Unknown Show"

      return {
        id: this.extractSpotifyId(url),
        title: title,
        description: description,
        url: url,
        publishedAt: new Date().toISOString(),
        duration: 0,
        showTitle: showTitle,
      }
    } catch (error) {
      console.error("Error extracting from Spotify page:", error)
      throw error
    }
  }

  private async processAppleEpisode(url: string): Promise<PodcastEpisode> {
    try {
      // Similar approach for Apple Podcasts
      const response = await fetch(`/api/podcast/extract?url=${encodeURIComponent(url)}`)
      const html = await response.text()

      const parser = new DOMParser()
      const doc = parser.parseFromString(html, "text/html")

      const title =
        doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        doc.querySelector("title")?.textContent ||
        "Unknown Episode"

      const description = doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || ""

      return {
        id: this.extractAppleId(url),
        title: title,
        description: description,
        url: url,
        publishedAt: new Date().toISOString(),
        duration: 0,
        showTitle: title.split(" - ")[0] || "Unknown Show",
      }
    } catch (error) {
      console.error("Error processing Apple episode:", error)
      throw error
    }
  }

  private async processYouTubeEpisode(url: string): Promise<PodcastEpisode> {
    try {
      // Extract YouTube video ID
      const videoId = this.extractYouTubeId(url)

      // Use YouTube API or extract from page
      const response = await fetch(`/api/podcast/youtube?videoId=${videoId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch YouTube video data")
      }

      const data = await response.json()

      return {
        id: videoId,
        title: data.title || "Unknown Video",
        description: data.description || "",
        url: url,
        publishedAt: data.publishedAt || new Date().toISOString(),
        duration: data.duration || 0,
        showTitle: data.channelTitle || "Unknown Channel",
      }
    } catch (error) {
      console.error("Error processing YouTube episode:", error)
      throw error
    }
  }

  private async processRSSEpisode(url: string): Promise<PodcastEpisode> {
    try {
      // For RSS feeds, parse the XML
      const response = await fetch(`/api/podcast/rss?url=${encodeURIComponent(url)}`)
      const data = await response.json()

      return {
        id: data.guid || `rss_${Date.now()}`,
        title: data.title || "Unknown Episode",
        description: data.description || "",
        url: url,
        publishedAt: data.pubDate || new Date().toISOString(),
        duration: data.duration || 0,
        showTitle: data.showTitle || "Unknown Show",
        audioUrl: data.enclosure?.url,
      }
    } catch (error) {
      console.error("Error processing RSS episode:", error)
      throw error
    }
  }

  private async getEpisodeTranscript(episode: PodcastEpisode): Promise<string | null> {
    try {
      // Try multiple methods to get transcript

      // 1. Check if transcript is available from the platform
      let transcript = await this.getOfficialTranscript(episode)

      if (transcript) {
        return transcript
      }

      // 2. Try to extract from description if it's detailed enough
      if (episode.description && episode.description.length > 500) {
        console.log("Using episode description as transcript fallback")
        return episode.description
      }

      // 3. For YouTube videos, try to get auto-generated captions
      if (episode.url.includes("youtube.com") || episode.url.includes("youtu.be")) {
        transcript = await this.getYouTubeCaptions(episode.id)
        if (transcript) {
          return transcript
        }
      }

      // 4. If we have audio URL, we could use speech-to-text (not implemented)
      if (episode.audioUrl) {
        console.log("Audio URL available but speech-to-text not implemented:", episode.audioUrl)
      }

      return null
    } catch (error) {
      console.error("Error getting episode transcript:", error)
      return null
    }
  }

  private async getOfficialTranscript(episode: PodcastEpisode): Promise<string | null> {
    try {
      // Check for official transcript links in description
      const transcriptUrls = this.extractTranscriptUrls(episode.description)

      for (const transcriptUrl of transcriptUrls) {
        try {
          const response = await fetch(`/api/podcast/transcript?url=${encodeURIComponent(transcriptUrl)}`)
          if (response.ok) {
            const transcript = await response.text()
            if (transcript && transcript.length > 100) {
              return transcript
            }
          }
        } catch (error) {
          console.log("Failed to fetch transcript from:", transcriptUrl)
        }
      }

      return null
    } catch (error) {
      console.error("Error getting official transcript:", error)
      return null
    }
  }

  private async getYouTubeCaptions(videoId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/podcast/youtube-captions?videoId=${videoId}`)

      if (!response.ok) {
        return null
      }

      const captions = await response.text()
      return captions && captions.length > 100 ? captions : null
    } catch (error) {
      console.error("Error getting YouTube captions:", error)
      return null
    }
  }

  private extractTranscriptUrls(description: string): string[] {
    const urls: string[] = []

    // Common patterns for transcript links
    const patterns = [
      /https?:\/\/[^\s]+transcript[^\s]*/gi,
      /https?:\/\/[^\s]+\.txt[^\s]*/gi,
      /https?:\/\/[^\s]+show-notes[^\s]*/gi,
    ]

    patterns.forEach((pattern) => {
      const matches = description.match(pattern)
      if (matches) {
        urls.push(...matches)
      }
    })

    return urls
  }

  private detectPlatform(url: string): "spotify" | "apple" | "rss" | "youtube" {
    if (url.includes("spotify.com")) return "spotify"
    if (url.includes("podcasts.apple.com")) return "apple"
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
    if (url.includes(".xml") || url.includes("rss") || url.includes("feed")) return "rss"
    return "rss" // Default fallback
  }

  private extractSpotifyId(url: string): string {
    const match = url.match(/episode\/([a-zA-Z0-9]+)/)
    return match ? match[1] : `spotify_${Date.now()}`
  }

  private extractAppleId(url: string): string {
    const match = url.match(/id(\d+)/)
    return match ? match[1] : `apple_${Date.now()}`
  }

  private extractYouTubeId(url: string): string {
    const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/, /youtube\.com\/embed\/([^&\n?#]+)/]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }

    return `youtube_${Date.now()}`
  }

  // Rest of the methods remain similar to the original implementation
  private loadSubscriptions(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const subscriptionsArray: PodcastSubscription[] = JSON.parse(stored)
        subscriptionsArray.forEach((subscription) => {
          this.subscriptions.set(subscription.id, subscription)
        })
        console.log(`Loaded ${subscriptionsArray.length} real podcast subscriptions`)
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

  async addSubscription(url: string): Promise<{ success: boolean; podcast?: PodcastSubscription; error?: string }> {
    try {
      console.log(`Adding real podcast subscription: ${url}`)

      // Extract show info from URL
      const showInfo = await this.extractShowInfo(url)

      // Check if subscription already exists
      const existingSubscription = Array.from(this.subscriptions.values()).find((sub) => sub.url === url)
      if (existingSubscription) {
        return { success: false, error: "Podcast already subscribed" }
      }

      const subscriptionId = `podcast_real_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
        rssUrl: showInfo.rssUrl,
      }

      this.subscriptions.set(subscriptionId, subscription)
      this.saveSubscriptions()

      // Start monitoring
      this.startSubscriptionMonitoring(subscriptionId)

      console.log(`Successfully added real podcast subscription: ${showInfo.title}`)
      return { success: true, podcast: subscription }
    } catch (error) {
      console.error("Error adding podcast subscription:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  private async extractShowInfo(url: string): Promise<{ title: string; description: string; rssUrl?: string }> {
    try {
      const response = await fetch(`/api/podcast/show-info?url=${encodeURIComponent(url)}`)

      if (!response.ok) {
        throw new Error("Failed to extract show info")
      }

      const data = await response.json()

      return {
        title: data.title || "Unknown Show",
        description: data.description || "",
        rssUrl: data.rssUrl,
      }
    } catch (error) {
      console.error("Error extracting show info:", error)
      return {
        title: "Unknown Show",
        description: "Could not extract show information",
      }
    }
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
    console.log(`Started monitoring real podcast subscription: ${subscription.title}`)
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

      // Get latest episodes from the platform
      const latestEpisodes = await this.getLatestEpisodes(subscription)

      if (latestEpisodes.length > 0) {
        console.log(`Found ${latestEpisodes.length} new episodes from ${subscription.title}`)

        // Process new episodes
        for (const episode of latestEpisodes) {
          try {
            await this.processEpisode(episode.url)
          } catch (error) {
            console.error(`Error processing episode ${episode.title}:`, error)
          }
        }

        // Update subscription metadata
        subscription.lastChecked = new Date().toISOString()
        subscription.episodeCount += latestEpisodes.length
        subscription.errorCount = 0

        this.subscriptions.set(subscriptionId, subscription)
        this.saveSubscriptions()

        // Trigger UI update event
        this.notifyUIUpdate(subscriptionId, latestEpisodes.length)
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

  private async getLatestEpisodes(subscription: PodcastSubscription): Promise<PodcastEpisode[]> {
    try {
      const response = await fetch(
        `/api/podcast/latest-episodes?url=${encodeURIComponent(subscription.url)}&lastChecked=${subscription.lastChecked}`,
      )

      if (!response.ok) {
        return []
      }

      const episodes = await response.json()
      return episodes || []
    } catch (error) {
      console.error("Error getting latest episodes:", error)
      return []
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

    console.log(`Removed real podcast subscription: ${subscription.title}`)
    return true
  }

  getProcessingStatus(): { activeSubscriptions: number; processingEpisodes: number; totalEpisodes: number } {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter((s) => s.isActive).length
    const totalEpisodes = Array.from(this.subscriptions.values()).reduce((sum, s) => sum + s.episodeCount, 0)

    return {
      activeSubscriptions,
      processingEpisodes: this.processingQueue.size,
      totalEpisodes,
    }
  }

  destroy(): void {
    this.intervals.forEach((interval) => {
      clearInterval(interval)
    })
    this.intervals.clear()
  }
}

export const realPodcastProcessor = RealPodcastProcessor.getInstance()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    realPodcastProcessor.destroy()
  })
}
