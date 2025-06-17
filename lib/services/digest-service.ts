import { mockDb } from "@/lib/database/mock-db"
import { memoryCache } from "@/lib/cache/memory-cache"

export class DigestService {
  private static instance: DigestService

  static getInstance(): DigestService {
    if (!DigestService.instance) {
      DigestService.instance = new DigestService()
    }
    return DigestService.instance
  }

  async getUserDigests(userId: string) {
    const cacheKey = `user-digests:${userId}`
    const cached = memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    const digests = await mockDb.getDigests(userId)

    // Cache for 5 minutes
    memoryCache.set(cacheKey, digests, 300)

    return digests
  }

  async generateDigest(userId: string, type: "weekly" | "monthly" | "quarterly") {
    // Get user's recent content based on digest type
    const content = await mockDb.getContent(userId, {
      timeframe: type,
      limit: 50,
    })

    if (!content.items || content.items.length === 0) {
      throw new Error("No content available for digest")
    }

    // Generate digest content
    const digestContent = await this.generateDigestContent(content.items, type)

    // Store digest
    const digest = await mockDb.createDigest({
      userId,
      type: type.toUpperCase() as any,
      title: `Your ${type} Digest`,
      content: digestContent,
      contentIds: content.items.map((c) => c.id),
      status: "SENT",
      scheduledAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    })

    // Invalidate cache
    memoryCache.del(`user-digests:${userId}`)

    return digest
  }

  private async generateDigestContent(content: any[], type: string): Promise<string> {
    // Simple digest generation - in production, use Grok API
    const priorityContent = content.filter((c) => c.analysis)

    let html = `<h1>Your ${type} Digest</h1>`
    html += `<p>Here are the ${priorityContent.length} most important items from your recent reading:</p>`

    for (const item of priorityContent.slice(0, 10)) {
      const analysis = item.analysis
      html += `
        <div style="margin-bottom: 20px; padding: 15px; border-left: 3px solid #007acc;">
          <h3><a href="${item.url || "#"}">${item.title}</a></h3>
          <p><strong>Priority:</strong> ${analysis.priority}</p>
          <p>${analysis.summary?.paragraph || "No summary available"}</p>
          <p><small>Source: ${item.source} | ${new Date(item.createdAt).toLocaleDateString()}</small></p>
        </div>
      `
    }

    return html
  }
}

export const digestService = DigestService.getInstance()
