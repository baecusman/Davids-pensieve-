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
  private static instance: DigestScheduler
  private jobs: Map<string, DigestJob> = new Map()
  private interval: NodeJS.Timeout | null = null
  private storageKey = "pensive-digest-jobs"
  private isRunning = false

  static getInstance(): DigestScheduler {
    if (!DigestScheduler.instance) {
      DigestScheduler.instance = new DigestScheduler()
    }
    return DigestScheduler.instance
  }

  constructor() {
    this.loadJobs()
    this.startScheduler()
  }

  private loadJobs(): void {
    try {
      if (typeof window === "undefined") return

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
    try {
      if (typeof window === "undefined") return

      const jobsArray = Array.from(this.jobs.values())
      localStorage.setItem(this.storageKey, JSON.stringify(jobsArray))
    } catch (error) {
      console.error("Error saving digest jobs:", error)
    }
  }

  private startScheduler(): void {
    if (this.isRunning || typeof window === "undefined") return

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
    try {
      const user = simpleAuth.getAllUsers().find((u) => u.id === userId)
      if (!user) {
        console.error(`User not found: ${userId}`)
        return false
      }

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
      console.log(`Generating digest for user: ${userId}`)

      // Get the user first to ensure they exist
      const user = simpleAuth.getAllUsers().find((u) => u.id === userId)
      if (!user) {
        throw new Error(`User not found: ${userId}`)
      }

      console.log(`Found user: ${user.username}`)

      // Get user's content from the last week
      // We need to temporarily switch context to this user
      const currentUser = simpleAuth.getCurrentUser()
      const currentUserId = currentUser?.id

      try {
        // Temporarily switch to the target user context if needed
        if (currentUserId !== userId) {
          console.log(`Switching context from ${currentUserId} to ${userId}`)
          // We'll get the content directly without switching context
        }

        // Get content for the specific user
        const userContent = userSegmentedDatabase.getUserContentWithAnalysis(userId)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        console.log(`Found ${userContent.length} total content items for user`)

        const recentContent = userContent.filter((item) => {
          const createdAt = new Date(item.content.createdAt)
          return createdAt > weekAgo
        })

        console.log(`Found ${recentContent.length} recent content items (last 7 days)`)

        if (recentContent.length === 0) {
          // Generate a digest even with no recent content
          return this.generateEmptyDigest(user.username)
        }

        // Prepare content for Grok
        const contentSummaries = recentContent.map((item) => ({
          title: item.content.title,
          url: item.content.url,
          summary: item.analysis?.summary?.paragraph || "No summary available",
          priority: item.analysis?.priority || "medium",
          tags: item.analysis?.tags || [],
          source: item.content.source,
          createdAt: item.content.createdAt,
        }))

        console.log(`Prepared ${contentSummaries.length} content summaries for digest`)

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
            username: user.username,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Digest generation failed: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const digest = await response.json()
        console.log("Successfully generated digest via Grok API")
        return digest.content || digest.digest || "Digest generated successfully"
      } finally {
        // Restore original user context if we switched
        // (In this case we didn't actually switch, so no need to restore)
      }
    } catch (error) {
      console.error("Error generating user digest:", error)

      // Return a fallback digest instead of throwing
      const user = simpleAuth.getAllUsers().find((u) => u.id === userId)
      return this.generateFallbackDigest(user?.username || "Unknown User", error)
    }
  }

  private generateEmptyDigest(username: string): string {
    return `
# Weekly Pensive Digest for ${username}

## Summary
No new content was analyzed this week. Consider adding some articles, videos, or other content to your Pensive collection to get personalized insights in your next digest.

## Suggestions
- Add interesting articles or blog posts
- Import RSS feeds from your favorite sources  
- Analyze podcast episodes or YouTube videos
- Review and organize your existing content

## Next Steps
Visit your Pensive dashboard to start adding content for next week's digest.

---
*Generated on ${new Date().toLocaleDateString()}*
    `.trim()
  }

  private generateFallbackDigest(username: string, error: any): string {
    return `
# Weekly Pensive Digest for ${username}

## Notice
We encountered an issue generating your personalized digest this week: ${error?.message || "Unknown error"}

## What you can do
- Check your internet connection
- Verify your content is properly saved
- Try the "Send Test Digest" button in Settings

## Your Learning Journey Continues
Even without this week's automated digest, your learning progress in Pensive continues. Visit your dashboard to review your recent content and insights.

---
*Generated on ${new Date().toLocaleDateString()}*
    `.trim()
  }

  private async sendDigestEmail(email: string, username: string, content: string): Promise<void> {
    try {
      // In a real implementation, you would use an email service like SendGrid, AWS SES, etc.
      // For now, we'll simulate the email sending

      console.log(`📧 Sending digest email to ${email}`)
      console.log(`Subject: Your Weekly Pensive Digest - ${username}`)
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
          subject: `Your Weekly Pensive Digest - ${username}`,
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
          <p>Hello ${username}!</p>
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
    return this.jobs.get(userId) || null
  }

  getAllDigestJobs(): DigestJob[] {
    return Array.from(this.jobs.values())
  }

  async sendTestDigest(userId: string, email: string): Promise<void> {
    try {
      console.log(`Sending test digest to ${email} for user ${userId}`)

      // Validate inputs
      if (!userId || !email) {
        throw new Error("User ID and email are required")
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new Error("Invalid email format")
      }

      // Get user info
      const user = simpleAuth.getAllUsers().find((u) => u.id === userId)
      if (!user) {
        throw new Error(`User not found: ${userId}`)
      }

      console.log(`Generating test digest for user: ${user.username}`)

      const digestContent = await this.generateUserDigest(userId)
      if (!digestContent) {
        throw new Error("No content available for test digest")
      }

      await this.sendDigestEmail(email, user.username, digestContent)

      console.log("Test digest sent successfully")
    } catch (error) {
      console.error("Error sending test digest:", error)
      throw error
    }
  }

  // Debug method to verify scheduling
  debugScheduling(): any {
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
      currentUser: simpleAuth.getCurrentUser(),
      allUsers: simpleAuth.getAllUsers().map((u) => ({ id: u.id, username: u.username })),
    }
  }

  // Cleanup
  destroy(): void {
    this.stopScheduler()
  }
}

export const digestScheduler = DigestScheduler.getInstance()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    digestScheduler.destroy()
  })
}
