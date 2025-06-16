interface TwitterAccount {
  id: string
  handle: string
  displayName: string
  description: string
  isActive: boolean
  createdAt: string
  lastChecked: string
  tweetCount: number
  errorCount: number
  lastError?: string
}

interface Tweet {
  id: string
  text: string
  createdAt: string
  author: string
  url: string
  metrics: {
    likes: number
    retweets: number
    replies: number
  }
}

class TwitterProcessor {
  private static instance: TwitterProcessor
  private accounts: Map<string, TwitterAccount> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private storageKey = "pensive-twitter-accounts"
  private processingQueue: Set<string> = new Set()

  static getInstance(): TwitterProcessor {
    if (!TwitterProcessor.instance) {
      TwitterProcessor.instance = new TwitterProcessor()
    }
    return TwitterProcessor.instance
  }

  constructor() {
    this.loadAccounts()
    this.startActiveAccounts()
  }

  private loadAccounts(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const accountsArray: TwitterAccount[] = JSON.parse(stored)
        accountsArray.forEach((account) => {
          this.accounts.set(account.id, account)
        })
        console.log(`Loaded ${accountsArray.length} Twitter accounts`)
      }
    } catch (error) {
      console.error("Error loading Twitter accounts:", error)
    }
  }

  private saveAccounts(): void {
    try {
      const accountsArray = Array.from(this.accounts.values())
      localStorage.setItem(this.storageKey, JSON.stringify(accountsArray))
    } catch (error) {
      console.error("Error saving Twitter accounts:", error)
    }
  }

  private startActiveAccounts(): void {
    this.accounts.forEach((account) => {
      if (account.isActive) {
        this.startAccountMonitoring(account.id)
      }
    })
  }

  async addAccount(handleOrUrl: string): Promise<{ success: boolean; account?: TwitterAccount; error?: string }> {
    try {
      console.log(`Adding Twitter account: ${handleOrUrl}`)

      // Extract handle from URL or use directly
      let handle = handleOrUrl
      if (handleOrUrl.includes("twitter.com/") || handleOrUrl.includes("x.com/")) {
        const match = handleOrUrl.match(/(?:twitter\.com|x\.com)\/([^/?]+)/)
        if (match) {
          handle = match[1]
        }
      }

      // Remove @ if present
      handle = handle.replace("@", "")

      // Check if account already exists
      const existingAccount = Array.from(this.accounts.values()).find((acc) => acc.handle === handle)
      if (existingAccount) {
        return { success: false, error: "Account already added" }
      }

      // For now, we'll create a mock account since we don't have Twitter API access
      // In production, you'd verify the account exists and get profile info
      const accountId = `twitter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const account: TwitterAccount = {
        id: accountId,
        handle,
        displayName: `@${handle}`, // Would get from API
        description: "Twitter account monitoring", // Would get from API
        isActive: true,
        createdAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
        tweetCount: 0,
        errorCount: 0,
      }

      this.accounts.set(accountId, account)
      this.saveAccounts()

      // Start monitoring
      this.startAccountMonitoring(accountId)

      console.log(`Successfully added Twitter account: @${handle}`)
      return { success: true, account }
    } catch (error) {
      console.error("Error adding Twitter account:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  private startAccountMonitoring(accountId: string): void {
    const account = this.accounts.get(accountId)
    if (!account || !account.isActive) return

    // Clear existing interval if any
    this.stopAccountMonitoring(accountId)

    // Check every 15 minutes for new tweets
    const intervalMs = 15 * 60 * 1000
    const interval = setInterval(async () => {
      await this.checkAccountForUpdates(accountId)
    }, intervalMs)

    this.intervals.set(accountId, interval)
    console.log(`Started monitoring Twitter account: @${account.handle}`)
  }

  private stopAccountMonitoring(accountId: string): void {
    const interval = this.intervals.get(accountId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(accountId)
    }
  }

  private async checkAccountForUpdates(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId)
    if (!account) return

    try {
      console.log(`Checking for updates: @${account.handle}`)

      // In a real implementation, you would:
      // 1. Use Twitter API v2 to fetch recent tweets
      // 2. Filter for tweets since last check
      // 3. Process each tweet through content analysis

      // For now, we'll simulate finding new tweets occasionally
      const hasNewTweets = Math.random() > 0.7 // 30% chance of new content

      if (hasNewTweets) {
        const newTweetCount = Math.floor(Math.random() * 3) + 1
        console.log(`Found ${newTweetCount} new tweets from @${account.handle}`)

        // Simulate processing tweets
        for (let i = 0; i < newTweetCount; i++) {
          await this.processTweet(accountId, {
            id: `tweet_${Date.now()}_${i}`,
            text: `Sample tweet content from @${account.handle} - ${new Date().toLocaleString()}`,
            createdAt: new Date().toISOString(),
            author: account.handle,
            url: `https://twitter.com/${account.handle}/status/${Date.now()}${i}`,
            metrics: {
              likes: Math.floor(Math.random() * 100),
              retweets: Math.floor(Math.random() * 50),
              replies: Math.floor(Math.random() * 25),
            },
          })
        }

        // Update account metadata
        account.lastChecked = new Date().toISOString()
        account.tweetCount += newTweetCount
        account.errorCount = 0

        this.accounts.set(accountId, account)
        this.saveAccounts()

        // Trigger UI update event
        this.notifyUIUpdate(accountId, newTweetCount)
      } else {
        // No new tweets, just update last checked
        account.lastChecked = new Date().toISOString()
        this.accounts.set(accountId, account)
        this.saveAccounts()
      }
    } catch (error) {
      console.error(`Error checking Twitter account @${account.handle}:`, error)

      // Update error count
      account.errorCount = (account.errorCount || 0) + 1
      account.lastError = error instanceof Error ? error.message : "Unknown error"

      // Disable account if too many errors
      if (account.errorCount >= 5) {
        account.isActive = false
        this.stopAccountMonitoring(accountId)
        console.warn(`Disabled Twitter account due to repeated errors: @${account.handle}`)
      }

      this.accounts.set(accountId, account)
      this.saveAccounts()
    }
  }

  private async processTweet(accountId: string, tweet: Tweet): Promise<void> {
    if (this.processingQueue.has(tweet.url)) {
      console.log(`Skipping ${tweet.id} - already processing`)
      return
    }

    try {
      console.log(`Processing tweet: ${tweet.id}`)
      this.processingQueue.add(tweet.url)

      // Import ContentProcessor dynamically to avoid circular dependencies
      const { ContentProcessor } = await import("./content-processor")

      // Analyze the tweet content
      await ContentProcessor.analyzeContent({
        title: `Tweet by @${tweet.author}`,
        content: tweet.text,
        url: tweet.url,
      })

      console.log(`Successfully processed tweet: ${tweet.id}`)

      // Small delay to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`Error processing tweet ${tweet.id}:`, error)
    } finally {
      this.processingQueue.delete(tweet.url)
    }
  }

  private notifyUIUpdate(accountId: string, newTweetCount: number): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("twitter-update", {
          detail: { accountId, newTweetCount },
        }),
      )
    }
  }

  getAccounts(): TwitterAccount[] {
    return Array.from(this.accounts.values()).sort(
      (a, b) => new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime(),
    )
  }

  getAccount(accountId: string): TwitterAccount | null {
    return this.accounts.get(accountId) || null
  }

  async toggleAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId)
    if (!account) return false

    account.isActive = !account.isActive

    if (account.isActive) {
      this.startAccountMonitoring(accountId)
    } else {
      this.stopAccountMonitoring(accountId)
    }

    this.accounts.set(accountId, account)
    this.saveAccounts()

    return account.isActive
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId)
    if (!account) return false

    this.stopAccountMonitoring(accountId)
    this.accounts.delete(accountId)
    this.saveAccounts()

    console.log(`Removed Twitter account: @${account.handle}`)
    return true
  }

  // Get processing status
  getProcessingStatus(): { activeAccounts: number; processingTweets: number; totalTweets: number } {
    const activeAccounts = Array.from(this.accounts.values()).filter((a) => a.isActive).length
    const totalTweets = Array.from(this.accounts.values()).reduce((sum, a) => sum + a.tweetCount, 0)

    return {
      activeAccounts,
      processingTweets: this.processingQueue.size,
      totalTweets,
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

export const twitterProcessor = TwitterProcessor.getInstance()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    twitterProcessor.destroy()
  })
}
