import { prisma } from "@/lib/database/prisma"
import { memoryCache } from "@/lib/cache/memory-cache"
import { jobQueue } from "./job-queue"
import crypto from "crypto"

export class ContentService {
  private static instance: ContentService

  static getInstance(): ContentService {
    if (!ContentService.instance) {
      ContentService.instance = new ContentService()
    }
    return ContentService.instance
  }

  async storeContent(
    userId: string,
    data: {
      title: string
      url: string
      content: string
      source: string
    },
  ) {
    // Generate content hash for deduplication
    const hash = crypto
      .createHash("sha256")
      .update(data.url + data.content)
      .digest("hex")

    // Check if content already exists for this user
    const existing = await prisma.content.findUnique({
      where: {
        userId_hash: {
          userId,
          hash,
        },
      },
    })

    if (existing) {
      return { contentId: existing.id, isNew: false }
    }

    // Store new content
    const content = await prisma.content.create({
      data: {
        userId,
        title: data.title,
        url: data.url,
        content: data.content,
        source: data.source,
        hash,
      },
    })

    // Queue analysis job
    await jobQueue.addJob(jobQueue.JobTypes.ANALYZE_CONTENT, {
      contentId: content.id,
      userId,
      title: data.title,
      content: data.content,
      url: data.url,
    })

    // Invalidate user content cache
    await this.invalidateUserContentCache(userId)

    return { contentId: content.id, isNew: true }
  }

  async getUserContent(
    userId: string,
    options: {
      page?: number
      limit?: number
      source?: string
      priority?: string
      timeframe?: "WEEKLY" | "MONTHLY" | "QUARTERLY"
    } = {},
  ) {
    const page = options.page || 1
    const limit = options.limit || 50
    const offset = (page - 1) * limit

    // Try cache first
    const cacheKey = memoryCache.keys.userContent(userId, page)
    const cached = await memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    // Build where clause
    const where: any = { userId }

    if (options.source) {
      where.source = options.source
    }

    if (options.timeframe) {
      const cutoff = this.getTimeframeCutoff(options.timeframe)
      where.createdAt = { gte: cutoff }
    }

    // Get content with analyses
    const content = await prisma.content.findMany({
      where,
      include: {
        analyses: {
          where: options.priority ? { priority: options.priority as any } : undefined,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    })

    const total = await prisma.content.count({ where })

    const result = {
      items: content.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        content: item.content,
        source: item.source,
        createdAt: item.createdAt,
        analysis: item.analyses[0] || null,
      })),
      total,
      hasMore: offset + limit < total,
      page,
      totalPages: Math.ceil(total / limit),
    }

    // Cache for 5 minutes
    await memoryCache.set(cacheKey, result, 300)

    return result
  }

  async getConceptMap(userId: string, abstractionLevel = 50, searchQuery = "") {
    const cacheKey = memoryCache.keys.conceptMap(userId, abstractionLevel)
    const cached = await memoryCache.getJSON<any>(cacheKey)
    if (cached && !searchQuery) {
      return cached
    }

    // Get concepts with frequency filtering using raw SQL for better performance
    const maxFrequencyResult = await prisma.$queryRaw<[{ max_frequency: number }]>`
      SELECT MAX(frequency) as max_frequency 
      FROM concepts 
      WHERE "userId" = ${userId}
    `

    const maxFrequency = maxFrequencyResult[0]?.max_frequency || 1
    const minFrequency = Math.max(1, Math.floor((abstractionLevel / 100) * maxFrequency))

    let conceptsQuery = `
      SELECT c.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', r.id,
                   'toConceptId', r."toConceptId",
                   'type', r.type,
                   'strength', r.strength,
                   'toConceptName', tc.name
                 )
               ) FILTER (WHERE r.id IS NOT NULL), 
               '[]'
             ) as relationships
      FROM concepts c
      LEFT JOIN relationships r ON c.id = r."fromConceptId"
      LEFT JOIN concepts tc ON r."toConceptId" = tc.id
      WHERE c."userId" = $1 
        AND c.frequency >= $2
    `

    const params: any[] = [userId, minFrequency]

    if (searchQuery) {
      conceptsQuery += ` AND c.name ILIKE $3`
      params.push(`%${searchQuery}%`)
    }

    conceptsQuery += ` GROUP BY c.id ORDER BY c.frequency DESC`

    const concepts = (await prisma.$queryRawUnsafe(conceptsQuery, ...params)) as any[]

    // Transform to graph format
    const nodes = concepts.map((concept) => ({
      id: concept.id,
      label: concept.name,
      type: concept.type,
      frequency: concept.frequency,
      density: this.calculateNodeDensity(concept.frequency, maxFrequency),
      description: concept.description,
    }))

    const edges = concepts.flatMap((concept) =>
      (concept.relationships || []).map((rel: any) => ({
        id: rel.id,
        source: concept.id,
        target: rel.toConceptId,
        type: rel.type,
        weight: rel.strength,
      })),
    )

    const result = { nodes, edges }

    // Cache for 10 minutes if no search query
    if (!searchQuery) {
      await memoryCache.set(cacheKey, result, 600)
    }

    return result
  }

  private calculateNodeDensity(frequency: number, maxFrequency: number): number {
    if (maxFrequency <= 1) return 50
    return Math.min(100, Math.max(10, (frequency / maxFrequency) * 100))
  }

  private getTimeframeCutoff(timeframe: "WEEKLY" | "MONTHLY" | "QUARTERLY"): Date {
    const now = new Date()
    const cutoff = new Date()

    switch (timeframe) {
      case "WEEKLY":
        cutoff.setDate(now.getDate() - 7)
        break
      case "MONTHLY":
        cutoff.setMonth(now.getMonth() - 1)
        break
      case "QUARTERLY":
        cutoff.setMonth(now.getMonth() - 3)
        break
    }

    return cutoff
  }

  private async invalidateUserContentCache(userId: string) {
    // Invalidate all pages of user content cache
    for (let page = 1; page <= 10; page++) {
      const cacheKey = memoryCache.keys.userContent(userId, page)
      await memoryCache.del(cacheKey)
    }
  }
}

export const contentService = ContentService.getInstance()
