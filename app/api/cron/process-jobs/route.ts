import { type NextRequest, NextResponse } from "next/server"
import { jobQueue } from "@/lib/services/job-queue"
import { memoryCache } from "@/lib/cache/memory-cache"
import { prisma } from "@/lib/database/prisma"

// Verify cron secret
function verifyCronSecret(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn("CRON_SECRET not configured")
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("🔄 Processing job queue...")

  let processedJobs = 0
  const maxJobs = 50 // Process up to 50 jobs per run

  try {
    while (processedJobs < maxJobs) {
      const job = await jobQueue.getNextJob()

      if (!job) {
        break // No more jobs to process
      }

      try {
        await processJob(job)
        await jobQueue.completeJob(job.id)
        processedJobs++
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error)
        await jobQueue.failJob(job.id, error instanceof Error ? error.message : "Unknown error")
      }
    }

    // Clean up old jobs
    await jobQueue.cleanup()

    const stats = await jobQueue.getStats()

    return NextResponse.json({
      success: true,
      processedJobs,
      queueStats: stats,
    })
  } catch (error) {
    console.error("Job processing error:", error)
    return NextResponse.json({ error: "Job processing failed" }, { status: 500 })
  }
}

async function processJob(job: any) {
  console.log(`🔨 Processing job: ${job.type} (${job.id})`)

  switch (job.type) {
    case jobQueue.JobTypes.ANALYZE_CONTENT:
      await processAnalyzeContent(job)
      break

    case jobQueue.JobTypes.FETCH_RSS:
      await processFetchRSS(job)
      break

    case jobQueue.JobTypes.GENERATE_DIGEST:
      await processGenerateDigest(job)
      break

    case jobQueue.JobTypes.SEND_EMAIL:
      await processSendEmail(job)
      break

    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

async function processAnalyzeContent(job: any) {
  const { contentId, userId, title, content, url } = job.payload

  // Check cache first
  const contentHash = require("crypto")
    .createHash("sha256")
    .update(url + content)
    .digest("hex")

  const cacheKey = memoryCache.keys.grokAnalysis(contentHash)
  let analysis = await memoryCache.getJSON(cacheKey)

  if (!analysis) {
    // Call Grok API
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/grok/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, title, url }),
    })

    if (!response.ok) {
      throw new Error(`Grok API failed: ${response.statusText}`)
    }

    const result = await response.json()
    analysis = result.analysis

    // Cache for 24 hours
    await memoryCache.set(cacheKey, analysis, 24 * 60 * 60)
  }

  // Store analysis in database
  await prisma.analysis.create({
    data: {
      userId,
      contentId,
      summary: analysis.summary,
      entities: analysis.entities,
      tags: analysis.tags,
      priority: analysis.priority,
      fullContent: analysis.fullContent,
      confidence: analysis.confidence || 0.8,
    },
  })

  // Process concepts
  await processConcepts(userId, contentId, analysis.entities)
}

async function processFetchRSS(job: any) {
  const { sourceId, userId } = job.payload

  const source = await prisma.source.findUnique({
    where: { id: sourceId },
  })

  if (!source || !source.isActive) {
    return
  }

  // Check cache first
  const cacheKey = memoryCache.keys.rssFeed(source.url)
  const feedData = await memoryCache.getJSON(cacheKey)

  if (!feedData) {
    // Fetch RSS feed with conditional headers
    const headers: Record<string, string> = {
      "User-Agent": "Pensive RSS Reader/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    }

    if (source.etag) {
      headers["If-None-Match"] = source.etag
    }
    if (source.lastModified) {
      headers["If-Modified-Since"] = source.lastModified
    }

    const response = await fetch(source.url, { headers })

    if (response.status === 304) {
      // Not modified, update lastFetched and return
      await prisma.source.update({
        where: { id: sourceId },
        data: { lastFetched: new Date() },
      })
      return
    }

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.statusText}`)
    }

    const xmlText = await response.text()

    // Parse RSS (you'd use fast-xml-parser here)
    const feedData = parseRSSXML(xmlText)

    // Update source metadata
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        lastFetched: new Date(),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      },
    })

    // Cache for 1 hour
    await memoryCache.set(cacheKey, feedData, 3600)
  }

  // Process new items
  for (const item of feedData.items.slice(0, 10)) {
    // Limit to 10 newest items
    const contentHash = require("crypto")
      .createHash("sha256")
      .update(item.link + item.description)
      .digest("hex")

    // Check if we already have this content
    const existing = await prisma.content.findUnique({
      where: { userId_hash: { userId, hash: contentHash } },
    })

    if (!existing) {
      // Store new content and queue for analysis
      const content = await prisma.content.create({
        data: {
          userId,
          title: item.title,
          url: item.link,
          content: item.description,
          source: source.name,
          hash: contentHash,
        },
      })

      // Queue analysis
      await jobQueue.addJob(jobQueue.JobTypes.ANALYZE_CONTENT, {
        contentId: content.id,
        userId,
        title: item.title,
        content: item.description,
        url: item.link,
      })
    }
  }
}

async function processGenerateDigest(job: any) {
  const { userId, type } = job.payload

  // Get user's recent content based on digest type
  const cutoff = getDigestCutoff(type)

  const content = await prisma.content.findMany({
    where: {
      userId,
      createdAt: { gte: cutoff },
    },
    include: {
      analyses: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  if (content.length === 0) {
    return // No content to digest
  }

  // Generate digest using Grok
  const digestContent = await generateDigestContent(content, type)

  // Store digest
  const digest = await prisma.digest.create({
    data: {
      userId,
      type: type.toUpperCase(),
      title: `Your ${type} Digest`,
      content: digestContent,
      contentIds: content.map((c) => c.id),
      status: "SCHEDULED",
      scheduledAt: new Date(),
    },
  })

  // Queue email sending
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.digestEmail) {
    await jobQueue.addJob(jobQueue.JobTypes.SEND_EMAIL, {
      to: user.digestEmail,
      subject: `Your ${type} Digest`,
      html: digestContent,
      digestId: digest.id,
    })
  }
}

async function processSendEmail(job: any) {
  const { to, subject, html, digestId } = job.payload

  // Here you'd integrate with your email service (SendGrid, AWS SES, etc.)
  // For now, we'll just log it
  console.log(`📧 Would send email to ${to}: ${subject}`)

  if (digestId) {
    await prisma.digest.update({
      where: { id: digestId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    })
  }
}

async function processConcepts(userId: string, contentId: string, entities: any[]) {
  for (const entity of entities) {
    // Upsert concept
    const concept = await prisma.concept.upsert({
      where: {
        userId_name_type: {
          userId,
          name: entity.name,
          type: entity.type,
        },
      },
      update: {
        frequency: { increment: 1 },
      },
      create: {
        userId,
        name: entity.name,
        type: entity.type,
        frequency: 1,
      },
    })

    // Create relationships with other concepts in the same content
    const otherEntities = entities.filter((e) => e.name !== entity.name)

    for (const otherEntity of otherEntities) {
      const otherConcept = await prisma.concept.findUnique({
        where: {
          userId_name_type: {
            userId,
            name: otherEntity.name,
            type: otherEntity.type,
          },
        },
      })

      if (otherConcept) {
        await prisma.relationship.upsert({
          where: {
            userId_fromConceptId_toConceptId_contentId: {
              userId,
              fromConceptId: concept.id,
              toConceptId: otherConcept.id,
              contentId,
            },
          },
          update: {
            strength: { increment: 0.1 },
          },
          create: {
            userId,
            fromConceptId: concept.id,
            toConceptId: otherConcept.id,
            contentId,
            type: "RELATES_TO",
            strength: 0.5,
          },
        })
      }
    }
  }
}

function parseRSSXML(xmlText: string) {
  // Basic RSS parsing - in production, use fast-xml-parser
  const feed = {
    title: "Unknown Feed",
    items: [] as any[],
  }

  // Extract items (simplified)
  const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || []

  feed.items = itemMatches.slice(0, 20).map((itemXml, index) => {
    const titleMatch = itemXml.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i)
    const linkMatch = itemXml.match(/<link[^>]*>(.*?)<\/link>/i)
    const descMatch = itemXml.match(
      /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i,
    )

    return {
      title: (titleMatch?.[1] || titleMatch?.[2] || "Untitled").trim(),
      link: linkMatch?.[1]?.trim() || "",
      description: (descMatch?.[1] || descMatch?.[2] || "").replace(/<[^>]+>/g, " ").trim(),
    }
  })

  return feed
}

function getDigestCutoff(type: string): Date {
  const now = new Date()
  const cutoff = new Date()

  switch (type.toUpperCase()) {
    case "WEEKLY":
      cutoff.setDate(now.getDate() - 7)
      break
    case "MONTHLY":
      cutoff.setMonth(now.getMonth() - 1)
      break
    case "QUARTERLY":
      cutoff.setMonth(now.getMonth() - 3)
      break
    default:
      cutoff.setDate(now.getDate() - 7)
  }

  return cutoff
}

async function generateDigestContent(content: any[], type: string): Promise<string> {
  // Simple digest generation - in production, use Grok API
  const priorityContent = content.filter((c) => c.analyses.length > 0)

  let html = `<h1>Your ${type} Digest</h1>`
  html += `<p>Here are the ${priorityContent.length} most important items from your recent reading:</p>`

  for (const item of priorityContent.slice(0, 10)) {
    const analysis = item.analyses[0]
    html += `
      <div style="margin-bottom: 20px; padding: 15px; border-left: 3px solid #007acc;">
        <h3><a href="${item.url}">${item.title}</a></h3>
        <p><strong>Priority:</strong> ${analysis.priority}</p>
        <p>${analysis.summary?.paragraph || "No summary available"}</p>
        <p><small>Source: ${item.source} | ${new Date(item.createdAt).toLocaleDateString()}</small></p>
      </div>
    `
  }

  return html
}
