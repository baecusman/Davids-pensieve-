import type { NextRequest } from "next/server"
import { prisma } from "@/lib/database/prisma"
import { cacheService } from "@/lib/cache/redis"
import { XMLParser } from "fast-xml-parser"

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Get all active feeds that need updating
    const now = new Date()
    const feeds = await prisma.feed.findMany({
      where: {
        isActive: true,
        OR: [
          { lastFetched: null },
          {
            lastFetched: {
              lt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
            },
          },
        ],
      },
    })

    console.log(`Processing ${feeds.length} RSS feeds`)

    const results = []

    for (const feed of feeds) {
      try {
        const result = await processFeed(feed)
        results.push(result)
      } catch (error) {
        console.error(`Error processing feed ${feed.url}:`, error)

        // Update error count
        await prisma.feed.update({
          where: { id: feed.id },
          data: {
            errorCount: { increment: 1 },
            lastError: error instanceof Error ? error.message : "Unknown error",
            lastFetched: now,
          },
        })

        results.push({
          feedId: feed.id,
          status: "error",
          error: error.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("RSS cron job error:", error)
    return new Response(JSON.stringify({ error: "Cron job failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

async function processFeed(feed: any) {
  const cacheKey = cacheService.keys.rssFeed(feed.url)

  // Check cache first
  const cached = await cacheService.getJSON(cacheKey)
  if (cached) {
    console.log(`Using cached RSS data for ${feed.url}`)
    return { feedId: feed.id, status: "cached", items: 0 }
  }

  // Prepare conditional request headers
  const headers: Record<string, string> = {
    "User-Agent": "Pensive RSS Reader/2.0",
    Accept: "application/rss+xml, application/xml, text/xml",
  }

  if (feed.etag) {
    headers["If-None-Match"] = feed.etag
  }

  if (feed.lastModified) {
    headers["If-Modified-Since"] = feed.lastModified
  }

  const response = await fetch(feed.url, { headers })

  // Handle 304 Not Modified
  if (response.status === 304) {
    await prisma.feed.update({
      where: { id: feed.id },
      data: { lastFetched: new Date() },
    })

    return { feedId: feed.id, status: "not_modified", items: 0 }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const xmlText = await response.text()
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  })

  const parsed = parser.parse(xmlText)
  const rssData = parsed.rss || parsed.feed // Handle both RSS and Atom

  if (!rssData) {
    throw new Error("Invalid RSS/Atom feed format")
  }

  const channel = rssData.channel || rssData
  const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean)

  let newItemsCount = 0

  // Process new items
  for (const item of items.slice(0, 10)) {
    // Limit to 10 newest items
    try {
      const itemUrl = item.link || item.id
      const itemTitle = item.title || "Untitled"
      const itemDate = new Date(item.pubDate || item.published || Date.now())

      // Skip if we've seen this item before
      if (feed.lastItemDate && itemDate <= new Date(feed.lastItemDate)) {
        continue
      }

      // Queue item for analysis
      await queueItemForAnalysis(feed.userId, {
        title: itemTitle,
        url: itemUrl,
        description: item.description || item.summary || "",
        source: `RSS: ${feed.title}`,
        publishedAt: itemDate,
      })

      newItemsCount++
    } catch (itemError) {
      console.error(`Error processing RSS item:`, itemError)
    }
  }

  // Update feed metadata
  const updateData: any = {
    lastFetched: new Date(),
    itemCount: { increment: newItemsCount },
    errorCount: 0,
    lastError: null,
  }

  if (newItemsCount > 0) {
    updateData.lastItemDate = new Date()
  }

  // Store conditional request headers
  const etag = response.headers.get("etag")
  const lastModified = response.headers.get("last-modified")

  if (etag) updateData.etag = etag
  if (lastModified) updateData.lastModified = lastModified

  await prisma.feed.update({
    where: { id: feed.id },
    data: updateData,
  })

  // Cache the parsed feed for 30 minutes
  await cacheService.set(cacheKey, { items, lastFetched: new Date() }, 1800)

  return {
    feedId: feed.id,
    status: "success",
    items: newItemsCount,
  }
}

async function queueItemForAnalysis(userId: string, item: any) {
  // Add to analysis queue (using Redis lists as a simple queue)
  const queueKey = "analysis_queue"

  await cacheService.redis.lpush(
    queueKey,
    JSON.stringify({
      userId,
      ...item,
      queuedAt: new Date().toISOString(),
    }),
  )
}
