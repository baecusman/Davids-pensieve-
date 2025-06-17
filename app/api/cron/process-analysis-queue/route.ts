import type { NextRequest } from "next/server"
import { cacheService } from "@/lib/cache/redis"

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const queueKey = "analysis_queue"
    const processed = []

    // Process up to 10 items from the queue
    for (let i = 0; i < 10; i++) {
      const item = await cacheService.redis.rpop(queueKey)
      if (!item) break

      try {
        const queuedItem = JSON.parse(item)

        // Analyze the content
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/content/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            url: queuedItem.url,
            userId: queuedItem.userId,
          }),
        })

        if (response.ok) {
          processed.push({ url: queuedItem.url, status: "success" })
        } else {
          processed.push({ url: queuedItem.url, status: "failed" })
        }
      } catch (error) {
        console.error("Error processing queued item:", error)
        processed.push({ item, status: "error", error: error.message })
      }
    }

    return new Response(
      JSON.stringify({
        processed: processed.length,
        items: processed,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Analysis queue cron job error:", error)
    return new Response(JSON.stringify({ error: "Cron job failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
