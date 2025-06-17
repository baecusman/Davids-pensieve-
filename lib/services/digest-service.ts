import { supabase } from "@/lib/database/supabase-client"
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

    const { data: digests, error } = await supabase
      .from("digests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error getting user digests:", error)
      return []
    }

    // Cache for 5 minutes
    memoryCache.set(cacheKey, digests, 300)

    return digests
  }

  async generateDigest(userId: string, type: "weekly" | "monthly" | "quarterly") {
    // Get user's recent content based on digest type
    const cutoff = this.getTimeframeCutoff(type)

    const { data: content, error } = await supabase
      .from("content")
      .select(`
        *,
        analysis:analysis(*)
      `)
      .eq("user_id", userId)
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error getting content for digest:", error)
      throw new Error(`Failed to generate digest: ${error.message}`)
    }

    if (!content || content.length === 0) {
      throw new Error("No content available for digest")
    }

    // Generate digest content
    const digestContent = await this.generateDigestContent(content, type)

    // Store digest
    const { data: digest, error: digestError } = await supabase
      .from("digests")
      .insert({
        user_id: userId,
        type: type.toUpperCase(),
        title: `Your ${type} Digest`,
        content: digestContent,
        content_ids: content.map((c) => c.id),
        status: "GENERATED",
        scheduled_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (digestError) {
      console.error("Error storing digest:", digestError)
      throw new Error(`Failed to store digest: ${digestError.message}`)
    }

    // Invalidate cache
    memoryCache.del(`user-digests:${userId}`)

    return digest
  }

  private async generateDigestContent(content: any[], type: string): Promise<string> {
    // Simple digest generation - in production, use Grok API
    const priorityContent = content.filter((c) => c.analysis && c.analysis.length > 0)

    let html = `<h1>Your ${type} Digest</h1>`
    html += `<p>Here are the ${priorityContent.length} most important items from your recent reading:</p>`

    for (const item of priorityContent.slice(0, 10)) {
      const analysis = item.analysis[0]
      html += `
        <div style="margin-bottom: 20px; padding: 15px; border-left: 3px solid #007acc;">
          <h3><a href="${item.url}">${item.title}</a></h3>
          <p><strong>Priority:</strong> ${analysis.priority}</p>
          <p>${analysis.summary?.paragraph || "No summary available"}</p>
          <p><small>Source: ${item.source} | ${new Date(item.created_at).toLocaleDateString()}</small></p>
        </div>
      `
    }

    return html
  }

  private getTimeframeCutoff(type: string): Date {
    const now = new Date()
    const cutoff = new Date()

    switch (type) {
      case "weekly":
        cutoff.setDate(now.getDate() - 7)
        break
      case "monthly":
        cutoff.setMonth(now.getMonth() - 1)
        break
      case "quarterly":
        cutoff.setMonth(now.getMonth() - 3)
        break
      default:
        cutoff.setDate(now.getDate() - 7)
    }

    return cutoff
  }
}

export const digestService = DigestService.getInstance()
