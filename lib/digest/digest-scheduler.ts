import { simpleAuth } from "../auth/simple-auth"
import { userSegmentedDatabase } from "../database/user-segmented-database"

interface DigestJob {
  userId: string
  username: string
  email: string
  scheduledFor: string
  status: "pending" | "processing" | "completed" | "failed"
  lastSent?: string
  error?: string
}

class DigestScheduler {
  private static instance: DigestScheduler | null = null
  private jobs: Map<string, DigestJob> = new Map()
  private interval: NodeJS.Timeout | null = null
  private storageKey = "pensive-digest-jobs"
  private isRunning = false
  private isClient: boolean
  private initialized = false

  static getInstance(): DigestScheduler {
    if (!DigestScheduler.instance) {
      DigestScheduler.instance = new DigestScheduler()
    }
    return DigestScheduler.instance
  }

  constructor() {
    this.isClient = typeof window !== "undefined"
    // Don't initialize anything in constructor to avoid SSR issues
  }

  private ensureInitialized(): void {
    if (!this.initialized && this.isClient) {
      this.loadJobs()
      this.startScheduler()
      this.initialized = true
    }
  }

  private loadJobs(): void {
    if (!this.isClient) return

    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const jobsArray: DigestJob[] = JSON.parse(stored)
        jobsArray.forEach((job) => {
          this.jobs.set(job.userId, job)
        })
        console.log(`Loaded ${jobsArray.length} digest jobs`)
      }
    } catch (error) {
      console.error("Error loading digest jobs:", error)
    }
  }

  private saveJobs(): void {
    if (!this.isClient) return

    try {
      const jobsArray = Array.from(this.jobs.values())
      localStorage.setItem(this.storageKey, JSON.stringify(jobsArray))
    } catch (error) {
      console.error("Error saving digest jobs:", error)
    }
  }

  private startScheduler(): void {
    if (!this.isClient) return
    if (this.isRunning) return

    // Check every hour for pending digests
    this.interval = setInterval(
      () => {
        this.processPendingDigests()
      },
      60 * 60 * 1000,
    ) // 1 hour

    // Also check immediately
    setTimeout(() => this.processPendingDigests(), 5000)

    this.isRunning = true
    console.log("Digest scheduler started")
  }

  private stopScheduler(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.isRunning = false
  }

  scheduleUserDigest(userId: string, email: string): boolean {
    this.ensureInitialized()

    if (!this.isClient) return false

    try {
      const user = simpleAuth.getAllUsers().find((u) => u.id === userId)
      if (!user) return false

      const nextMonday = this.getNextMondayAt4AM()

      const job: DigestJob = {
        userId,
        username: user.username,
        email,
        scheduledFor: nextMonday.toISOString(),
        status: "pending",
      }

      this.jobs.set(userId, job)
      this.saveJobs()

      console.log(`Scheduled digest for user ${user.username} at ${nextMonday.toISOString()}`)
      return true
    } catch (error) {
      console.error("Error scheduling digest:", error)
      return false
    }
  }

  unscheduleUserDigest(userId: string): boolean {
    this.ensureInitialized()

    if (!this.isClient) return false

    try {
      this.jobs.delete(userId)
      this.saveJobs()
      console.log(`Unscheduled digest for user ${userId}`)
      return true
    } catch (error) {
      console.error("Error unscheduling digest:", error)
      return false
    }
  }

  private getNextMondayAt4AM(): Date {
    const now = new Date()

    // Get current time in ET
    const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))

    // Calculate days until next Monday (0=Sunday, 1=Monday, etc.)
    const currentDay = etNow.getDay()
    let daysUntilMonday: number

    if (currentDay === 1) {
      // If today is Monday
      // If it's before 4 AM, schedule for today at 4 AM
      if (etNow.getHours() < 4) {
        daysUntilMonday = 0
      } else {
        // If it's after 4 AM, schedule for next Monday
        daysUntilMonday = 7
      }
    } else {
      // Calculate days until next Monday
      daysUntilMonday = (1 + 7 - currentDay) % 7
      if (daysUntilMonday === 0) daysUntilMonday = 7
    }

    // Create the target date in ET
    const targetET = new Date(etNow)
    targetET.setDate(etNow.getDate() + daysUntilMonday)
    targetET.setHours(4, 0, 0, 0)

    // Convert ET to UTC for storage
    const targetUTC = new Date(targetET.toLocaleString("en-US", { timeZone: "UTC" }))

    // Adjust for timezone offset
    const etOffset = targetET.getTimezoneOffset()
    const utcOffset = targetUTC.getTimezoneOffset()
    const offsetDiff = etOffset - utcOffset

    targetUTC.setMinutes(targetUTC.getMinutes() + offsetDiff)

    return targetUTC
  }

  private async processPendingDigests(): Promise<void> {
    if (!this.isClient) return

    const now = new Date()
    const pendingJobs = Array.from(this.jobs.values()).filter(
      (job) => job.status === "pending" && new Date(job.scheduledFor) <= now,
    )

    if (pendingJobs.length === 0) return

    console.log(`Processing ${pendingJobs.length} pending digest jobs`)

    for (const job of pendingJobs) {
      await this.processDigestJob(job)
    }
  }

  private async processDigestJob(job: DigestJob): Promise<void> {
    try {
      console.log(`Processing digest job for user ${job.username}`)

      // Update job status
      job.status = "processing"
      this.jobs.set(job.userId, job)
      this.saveJobs()

      // Generate digest content
      const digestContent = await this.generateUserDigest(job.userId)

      if (!digestContent) {
        throw new Error("No content available for digest")
      }

      // Send email (simulate for now)
      await this.sendDigestEmail(job.email, job.username, digestContent)

      // Update job as completed
      job.status = "completed"
      job.lastSent = new Date().toISOString()

      // Schedule next week's digest
      const nextWeek = this.getNextMondayAt4AM()
      job.scheduledFor = nextWeek.toISOString()
      job.status = "pending"

      this.jobs.set(job.userId, job)
      this.saveJobs()

      console.log(`Digest sent successfully to ${job.email}`)
    } catch (error) {
      console.error(`Error processing digest job for user ${job.username}:`, error)

      // Update job as failed
      job.status = "failed"
      job.error = error instanceof Error ? error.message : "Unknown error"

      // Retry next week
      const nextWeek = this.getNextMondayAt4AM()
      job.scheduledFor = nextWeek.toISOString()

      this.jobs.set(job.userId, job)
      this.saveJobs()
    }
  }

  private async generateUserDigest(userId: string): Promise<string | null> {
    try {
      // Switch to user context temporarily
      const originalUser = simpleAuth.getCurrentUser()

      // Get user's content from the last week
      const userContent = userSegmentedDatabase.getUserContentWithAnalysis()
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const recentContent = userContent.filter((item) => new Date(item.content.createdAt) > weekAgo)

      if (recentContent.length === 0) {
        return null
      }

      // Prepare content for Grok
      const contentSummaries = recentContent.map((item) => ({
        title: item.content.title,
        url: item.content.url,
        summary: item.analysis.summary.paragraph,
        priority: item.analysis.priority,
        tags: item.analysis.tags,
        source: item.content.source,
      }))

      // Generate digest using Grok
      const response = await fetch("/api/grok/digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeframe: "weekly",
          content: contentSummaries,
          userId: userId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Digest generation failed: ${response.statusText}`)
      }

      const digest = await response.json()
      return digest.content
    } catch (error) {
      console.error("Error generating user digest:", error)
      throw error
    }
  }

  private async sendDigestEmail(email: string, username: string, content: string): Promise<void> {
    try {
      // In a real implementation, you would use an email service like SendGrid, AWS SES, etc.
      // For now, we'll simulate the email sending

      console.log(`📧 Sending digest email to ${email}`)
      console.log(`Subject: Your Weekly Pensive Digest - User ${username}`)
      console.log(`Content preview: ${content.substring(0, 200)}...`)

      // Simulate email sending delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // In production, you would make an API call to your email service:
      /*
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Your Weekly Pensive Digest - User ${username}`,
          html: this.formatDigestEmail(content, username)
        })
      });
      */

      console.log(`✅ Digest email sent successfully to ${email}`)
    } catch (error) {
      console.error("Error sending digest email:", error)
      throw error
    }
  }

  private formatDigestEmail(content: string, username: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your Weekly Pensive Digest</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Your Weekly Pensive Digest</h1>
          <p>Hello User ${username}!</p>
        </div>
        <div class="content">
          ${content.replace(/\n/g, "<br>")}
        </div>
        <div class="footer">
          <p>This digest was generated automatically by Pensive.</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `
  }

  // Public methods for UI
  getUserDigestStatus(userId: string): DigestJob | null {
    this.ensureInitialized()

    if (!this.isClient) return null
    return this.jobs.get(userId) || null
  }

  getAllDigestJobs(): DigestJob[] {
    this.ensureInitialized()

    if (!this.isClient) return []
    return Array.from(this.jobs.values())
  }

  async sendTestDigest(userId: string, email: string): Promise<void> {
    this.ensureInitialized()

    try {
      console.log(`Sending test digest to ${email}`)

      const digestContent = await this.generateUserDigest(userId)
      if (!digestContent) {
        throw new Error("No content available for test digest")
      }

      const user = simpleAuth.getAllUsers().find((u) => u.id === userId)
      await this.sendDigestEmail(email, user?.username || "Unknown", digestContent)

      console.log("Test digest sent successfully")
    } catch (error) {
      console.error("Error sending test digest:", error)
      throw error
    }
  }

  // Debug method to verify scheduling
  debugScheduling(): any {
    this.ensureInitialized()

    if (!this.isClient) {
      return {
        currentTime: { utc: "", et: "", dayOfWeek: 0 },
        nextDigest: { utc: "", et: "", dayOfWeek: 0, hoursFromNow: 0 },
        activeJobs: [],
        schedulerStatus: { isRunning: false, totalJobs: 0 },
      }
    }

    const now = new Date()
    const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
    const nextMonday = this.getNextMondayAt4AM()
    const etNextMonday = new Date(nextMonday.toLocaleString("en-US", { timeZone: "America/New_York" }))

    return {
      currentTime: {
        utc: now.toISOString(),
        et: etNow.toLocaleString("en-US", { timeZone: "America/New_York" }),
        dayOfWeek: etNow.getDay(), // 0=Sunday, 1=Monday, etc.
      },
      nextDigest: {
        utc: nextMonday.toISOString(),
        et: etNextMonday.toLocaleString("en-US", { timeZone: "America/New_York" }),
        dayOfWeek: etNextMonday.getDay(),
        hoursFromNow: Math.round((nextMonday.getTime() - now.getTime()) / (1000 * 60 * 60)),
      },
      activeJobs: Array.from(this.jobs.values()).map((job) => ({
        userId: job.userId,
        username: job.username,
        email: job.email,
        scheduledFor: job.scheduledFor,
        scheduledForET: new Date(job.scheduledFor).toLocaleString("en-US", { timeZone: "America/New_York" }),
        status: job.status,
        lastSent: job.lastSent,
      })),
      schedulerStatus: {
        isRunning: this.isRunning,
        totalJobs: this.jobs.size,
      },
    }
  }

  // Initialize method for client-side hydration
  initialize(): void {
    this.ensureInitialized()
  }

  // Cleanup
  destroy(): void {
    this.stopScheduler()
  }
}

// Create a function that returns the instance instead of creating it immediately
function getDigestSchedulerInstance(): DigestScheduler {
  return DigestScheduler.getInstance()
}

// Export the singleton instance with all methods
export const digestScheduler = {
  scheduleUserDigest: (userId: string, email: string) => getDigestSchedulerInstance().scheduleUserDigest(userId, email),

  unscheduleUserDigest: (userId: string) => getDigestSchedulerInstance().unscheduleUserDigest(userId),

  getUserDigestStatus: (userId: string) => getDigestSchedulerInstance().getUserDigestStatus(userId),

  getAllDigestJobs: () => getDigestSchedulerInstance().getAllDigestJobs(),

  sendTestDigest: (userId: string, email: string) => getDigestSchedulerInstance().sendTestDigest(userId, email),

  debugScheduling: () => getDigestSchedulerInstance().debugScheduling(),

  initialize: () => getDigestSchedulerInstance().initialize(),

  destroy: () => getDigestSchedulerInstance().destroy(),
}

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    digestScheduler.destroy()
  })
}
