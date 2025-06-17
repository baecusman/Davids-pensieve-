import { prisma } from "@/lib/database/prisma"

export interface JobPayload {
  [key: string]: any
}

export class JobQueue {
  private static instance: JobQueue

  static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue()
    }
    return JobQueue.instance
  }

  // Add a job to the queue
  async addJob(
    type: string,
    payload: JobPayload,
    options: {
      userId?: string
      scheduledAt?: Date
      maxAttempts?: number
    } = {},
  ) {
    const job = await prisma.job.create({
      data: {
        type,
        payload,
        userId: options.userId,
        scheduledAt: options.scheduledAt || new Date(),
        maxAttempts: options.maxAttempts || 3,
      },
    })

    console.log(`📋 Job queued: ${type} (${job.id})`)
    return job.id
  }

  // Get next pending job
  async getNextJob(types?: string[]) {
    const whereClause: any = {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
      attempts: { lt: prisma.job.fields.maxAttempts },
    }

    if (types && types.length > 0) {
      whereClause.type = { in: types }
    }

    const job = await prisma.job.findFirst({
      where: whereClause,
      orderBy: { scheduledAt: "asc" },
    })

    if (job) {
      // Mark as running
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      })
    }

    return job
  }

  // Mark job as completed
  async completeJob(jobId: string, result?: any) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        payload: result ? { ...result } : undefined,
      },
    })
    console.log(`✅ Job completed: ${jobId}`)
  }

  // Mark job as failed
  async failJob(jobId: string, error: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })

    if (!job) return

    const shouldRetry = job.attempts < job.maxAttempts

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? "PENDING" : "FAILED",
        error,
        scheduledAt: shouldRetry ? new Date(Date.now() + 5 * 60 * 1000) : undefined, // Retry in 5 minutes
      },
    })

    console.log(`❌ Job ${shouldRetry ? "failed (will retry)" : "permanently failed"}: ${jobId}`)
  }

  // Get job statistics
  async getStats() {
    const stats = await prisma.job.groupBy({
      by: ["status"],
      _count: { status: true },
    })

    return stats.reduce(
      (acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count.status
        return acc
      },
      {} as Record<string, number>,
    )
  }

  // Clean up old completed jobs
  async cleanup(olderThanDays = 7) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    const result = await prisma.job.deleteMany({
      where: {
        status: { in: ["COMPLETED", "FAILED"] },
        completedAt: { lt: cutoff },
      },
    })

    console.log(`🧹 Cleaned up ${result.count} old jobs`)
    return result.count
  }

  // Job types
  static JobTypes = {
    ANALYZE_CONTENT: "analyze_content",
    FETCH_RSS: "fetch_rss",
    GENERATE_DIGEST: "generate_digest",
    SEND_EMAIL: "send_email",
    PROCESS_PODCAST: "process_podcast",
  } as const
}

export const jobQueue = JobQueue.getInstance()
