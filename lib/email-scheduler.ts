interface DigestSchedule {
  frequency: "daily" | "weekly" | "monthly"
  time: string // HH:MM format
  timezone: string
  lastSent?: string
}

class EmailScheduler {
  private static instance: EmailScheduler
  private schedule: DigestSchedule | null = null
  private interval: NodeJS.Timeout | null = null
  private enabled = false

  static getInstance(): EmailScheduler {
    if (!EmailScheduler.instance) {
      EmailScheduler.instance = new EmailScheduler()
    }
    return EmailScheduler.instance
  }

  constructor() {
    this.loadSchedule()
    this.startScheduler()
  }

  private loadSchedule(): void {
    try {
      const stored = localStorage.getItem("pensive-email-schedule")
      if (stored) {
        this.schedule = JSON.parse(stored)
        this.enabled = true
        console.log("Loaded email schedule:", this.schedule)
      }
    } catch (error) {
      console.error("Error loading email schedule:", error)
    }
  }

  private saveSchedule(): void {
    try {
      if (this.schedule) {
        localStorage.setItem("pensive-email-schedule", JSON.stringify(this.schedule))
      }
    } catch (error) {
      console.error("Error saving email schedule:", error)
    }
  }

  updateSchedule(schedule: DigestSchedule): void {
    this.schedule = schedule
    this.enabled = true
    this.saveSchedule()
    this.restartScheduler()
    console.log("Updated email schedule:", schedule)
  }

  disable(): void {
    this.enabled = false
    this.stopScheduler()
    console.log("Email scheduler disabled")
  }

  private startScheduler(): void {
    if (!this.enabled || !this.schedule) return

    // Check every hour if it's time to send
    this.interval = setInterval(
      () => {
        this.checkAndSendDigest()
      },
      60 * 60 * 1000,
    ) // 1 hour

    console.log("Email scheduler started")
  }

  private stopScheduler(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private restartScheduler(): void {
    this.stopScheduler()
    this.startScheduler()
  }

  private async checkAndSendDigest(): Promise<void> {
    if (!this.enabled || !this.schedule) return

    try {
      const now = new Date()
      const shouldSend = this.shouldSendDigest(now)

      if (shouldSend) {
        console.log("Time to send digest!")
        // In a real implementation, you would send the actual email here
        // For now, we'll just simulate it
        await this.simulateDigestSend()

        // Update last sent time
        this.schedule.lastSent = now.toISOString()
        this.saveSchedule()
      }
    } catch (error) {
      console.error("Error checking digest schedule:", error)
    }
  }

  private shouldSendDigest(now: Date): boolean {
    if (!this.schedule) return false

    const lastSent = this.schedule.lastSent ? new Date(this.schedule.lastSent) : null
    const [hours, minutes] = this.schedule.time.split(":").map(Number)

    // Check if it's the right time of day
    if (now.getHours() !== hours || now.getMinutes() < minutes || now.getMinutes() >= minutes + 60) {
      return false
    }

    // Check frequency
    switch (this.schedule.frequency) {
      case "daily":
        return !lastSent || now.toDateString() !== lastSent.toDateString()

      case "weekly":
        if (!lastSent) return true
        const daysSinceLastSent = Math.floor((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24))
        return daysSinceLastSent >= 7

      case "monthly":
        if (!lastSent) return true
        return now.getMonth() !== lastSent.getMonth() || now.getFullYear() !== lastSent.getFullYear()

      default:
        return false
    }
  }

  private async simulateDigestSend(): Promise<void> {
    // In a real implementation, this would:
    // 1. Generate digest content from recent analyzed content
    // 2. Format as HTML email
    // 3. Send via email service (SendGrid, AWS SES, etc.)

    console.log("📧 Digest email sent (simulated)")

    // Trigger a notification event
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("digest-sent", {
          detail: { timestamp: new Date().toISOString() },
        }),
      )
    }
  }

  async sendTestDigest(emailAddress: string): Promise<void> {
    try {
      console.log(`Sending test digest to ${emailAddress}`)

      // In a real implementation, you would:
      // 1. Generate a sample digest
      // 2. Send it to the specified email address

      // For now, simulate the send
      await new Promise((resolve) => setTimeout(resolve, 2000))

      console.log("Test digest sent successfully")

      // Trigger notification
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("test-digest-sent", {
            detail: { emailAddress, timestamp: new Date().toISOString() },
          }),
        )
      }
    } catch (error) {
      console.error("Error sending test digest:", error)
      throw error
    }
  }

  getSchedule(): DigestSchedule | null {
    return this.schedule
  }

  isEnabled(): boolean {
    return this.enabled
  }

  // Cleanup method
  destroy(): void {
    this.stopScheduler()
  }
}

export const emailScheduler = EmailScheduler.getInstance()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    emailScheduler.destroy()
  })
}
