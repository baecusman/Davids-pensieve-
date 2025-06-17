import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/database/prisma"
import { jobQueue } from "@/lib/services/job-queue"

function verifyCronSecret(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return false
  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("📡 Scheduling RSS feed fetches...")

  try {
    // Get all active RSS sources
    const sources = await prisma.source.findMany({
      where: {
        type: "RSS",
        isActive: true,
      },
    })

    let scheduledCount = 0

    for (const source of sources) {
      await jobQueue.addJob(jobQueue.JobTypes.FETCH_RSS, {
        sourceId: source.id,
        userId: source.userId,
      })
      scheduledCount++
    }

    return NextResponse.json({
      success: true,
      scheduledFeeds: scheduledCount,
    })
  } catch (error) {
    console.error("RSS scheduling error:", error)
    return NextResponse.json({ error: "Failed to schedule RSS fetches" }, { status: 500 })
  }
}
