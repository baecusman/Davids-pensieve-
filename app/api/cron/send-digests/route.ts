import type { NextRequest } from "next/server"
import { prisma } from "@/lib/database/prisma"

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const now = new Date()

    // Find all pending digest jobs that are due
    const pendingJobs = await prisma.digestJob.findMany({
      where: {
        status: "PENDING",
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        user: true,
      },
    })

    console.log(`Processing ${pendingJobs.length} pending digest jobs`)

    const results = []

    for (const job of pendingJobs) {
      try {
        // Update job status to processing
        await prisma.digestJob.update({
          where: { id: job.id },
          data: { status: "PROCESSING" },
        })

        // Generate digest content
        const digestContent = await generateUserDigest(job.userId)

        if (digestContent) {
          // Send email (implement your email service here)
          await sendDigestEmail(job.email, job.user.email, digestContent)

          // Update job as completed and schedule next week
          const nextWeek = getNextMondayAt4AM()
          await prisma.digestJob.update({
            where: { id: job.id },
            data: {
              status: "COMPLETED",
              lastSent: now,
              scheduledFor: nextWeek,
              error: null,
            },
          })

          results.push({ userId: job.userId, status: "success" })
        } else {
          throw new Error("No content available for digest")
        }
      } catch (error) {
        console.error(`Error processing digest for user ${job.userId}:`, error)

        // Update job as failed and schedule retry next week
        const nextWeek = getNextMondayAt4AM()
        await prisma.digestJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
            scheduledFor: nextWeek,
          },
        })

        results.push({ userId: job.userId, status: "failed", error: error.message })
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
    console.error("Digest cron job error:", error)
    return new Response(JSON.stringify({ error: "Cron job failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

async function generateUserDigest(userId: string): Promise<string | null> {
  try {
    // Get user's content from the last week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const recentContent = await prisma.content.findMany({
      where: {
        userId,
        createdAt: {
          gte: weekAgo,
        },
      },
      include: {
        analyses: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    if (recentContent.length === 0) {
      return generateEmptyDigest()
    }

    // Prepare content for Grok
    const contentSummaries = recentContent.map((item) => ({
      title: item.title,
      url: item.url,
      summary: item.analyses[0]?.summary || {},
      priority: item.analyses[0]?.priority || "READ",
      tags: item.analyses[0]?.tags || [],
      source: item.source,
      createdAt: item.createdAt,
    }))

    // Generate digest using Grok
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/grok/digest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        timeframe: "weekly",
        content: contentSummaries,
        userId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Digest generation failed: ${response.statusText}`)
    }

    const digest = await response.json()
    return digest.content || digest.digest
  } catch (error) {
    console.error("Error generating user digest:", error)
    return generateFallbackDigest(error)
  }
}

function generateEmptyDigest(): string {
  return `
# Weekly Pensive Digest

## Summary
No new content was analyzed this week. Consider adding some articles, videos, or other content to your Pensive collection.

## Suggestions
- Add interesting articles or blog posts
- Import RSS feeds from your favorite sources  
- Analyze podcast episodes or YouTube videos

---
*Generated on ${new Date().toLocaleDateString()}*
  `.trim()
}

function generateFallbackDigest(error: any): string {
  return `
# Weekly Pensive Digest

## Notice
We encountered an issue generating your personalized digest this week: ${error?.message || "Unknown error"}

## Your Learning Journey Continues
Visit your Pensive dashboard to review your recent content and insights.

---
*Generated on ${new Date().toLocaleDateString()}*
  `.trim()
}

async function sendDigestEmail(email: string, userEmail: string, content: string): Promise<void> {
  // Implement your email service here (SendGrid, AWS SES, etc.)
  console.log(`📧 Sending digest email to ${email}`)
  console.log(`Content preview: ${content.substring(0, 200)}...`)

  // For now, just log the email
  // In production, integrate with your email service:
  /*
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }],
        subject: 'Your Weekly Pensive Digest'
      }],
      from: { email: 'noreply@pensive.app' },
      content: [{
        type: 'text/html',
        value: formatDigestEmail(content, userEmail)
      }]
    })
  })
  */
}

function getNextMondayAt4AM(): Date {
  const now = new Date()
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))

  const currentDay = etNow.getDay()
  let daysUntilMonday: number

  if (currentDay === 1) {
    daysUntilMonday = etNow.getHours() < 4 ? 0 : 7
  } else {
    daysUntilMonday = (1 + 7 - currentDay) % 7
    if (daysUntilMonday === 0) daysUntilMonday = 7
  }

  const targetET = new Date(etNow)
  targetET.setDate(etNow.getDate() + daysUntilMonday)
  targetET.setHours(4, 0, 0, 0)

  return targetET
}
