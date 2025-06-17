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

  console.log("📅 Scheduling weekly digests...")

  try {
    // Get all users who want weekly digests
    const users = await prisma.user.findMany({
      where: {
        digestFrequency: "WEEKLY",
        digestEmail: { not: null },
      },
    })

    let scheduledCount = 0

    for (const user of users) {
      // Check if user has content from the last week
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const contentCount = await prisma.content.count({
        where: {
          userId: user.id,
          createdAt: { gte: weekAgo },
        },
      })

      if (contentCount > 0) {
        await jobQueue.addJob(jobQueue.JobTypes.GENERATE_DIGEST, {
          userId: user.id,
          type: "weekly",
        })
        scheduledCount++
      }
    }

    return NextResponse.json({
      success: true,
      scheduledDigests: scheduledCount,
      totalUsers: users.length,
    })
  } catch (error) {
    console.error("Digest scheduling error:", error)
    return NextResponse.json({ error: "Failed to schedule digests" }, { status: 500 })
  }
}
