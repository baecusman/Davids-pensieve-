import { prisma } from "@/lib/database/prisma"

export class JobQueue {
  static JobTypes = {
    ANALYZE_CONTENT: "ANALYZE_CONTENT",
    FETCH_RSS: "FETCH_RSS",
    GENERATE_DIGEST: "GENERATE_DIGEST",
    SEND_EMAIL: "SEND_EMAIL",
  } as const

  async addJob(type: string, payload: any, userId?: string, scheduledAt?: Date) {
    return prisma.job.create({
      data: {
        type,
        payload,
        userId,
        scheduledAt: scheduledAt || new Date(),
      },
    })
  }

  async getNextJob() {
    const job = await prisma.job.findFirst({
      where: {
        status: "PENDING",
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
    })

    if (job) {
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

  async completeJob(jobId: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })
  }

  async failJob(jobId: string, error: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })

    if (!job) return

    const shouldRetry = job.attempts < job.maxAttempts

    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? "PENDING" : "FAILED",
        error,
        scheduledAt: shouldRetry ? new Date(Date.now() + 60000) : undefined, // Retry in 1 minute
      },
    })
  }

  async getStats() {
    const stats = await prisma.job.groupBy({
      by: ["status"],
      _count: true,
    })

    return stats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count
        return acc
      },
      {} as Record<string, number>,
    )
  }

  async cleanup() {
    // Delete completed jobs older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    return prisma.job.deleteMany({
      where: {
        status: { in: ["COMPLETED", "FAILED"] },
        completedAt: { lt: cutoff },
      },
    })
  }
}

export const jobQueue = new JobQueue()
