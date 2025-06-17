import { prisma } from "@/lib/database/prisma"
import { cacheService } from "@/lib/cache/redis"
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

    // Invalidate user content cache
    await this.invalidateUserContentCache(userId)

    return { contentId: content.id, isNew: true }
  }

  async storeAnalysis(
    userId: string,
    data: {
      contentId: string
      summary: any
      entities: any[]
      tags: string[]
      priority: "SKIM" | "READ" | "DEEP_DIVE"
      fullContent?: string
      confidence?: number
    },
  ) {
    const analysis = await prisma.analysis.create({
      data: {
        userId,
        contentId: data.contentId,
        summary: data.summary,
        entities: data.entities,
        tags: data.tags,
        priority: data.priority,
        fullContent: data.fullContent,
        confidence: data.confidence || 0.8,
      },
    })

    // Process concepts and relationships
    await this.processConcepts(userId, data.contentId, data.entities)

    // Invalidate related caches
    await this.invalidateUserContentCache(userId)
    await this.invalidateConceptMapCache(userId)

    return analysis.id
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
    const cacheKey = cacheService.keys.userContent(userId, page)
    const cached = await cacheService.getJSON<any>(cacheKey)
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
    await cacheService.set(cacheKey, result, 300)

    return result
  }

  async getConceptMap(userId: string, abstractionLevel = 50, searchQuery = "") {
    const cacheKey = cacheService.keys.conceptMap(userId, abstractionLevel)
    const cached = await cacheService.getJSON<any>(cacheKey)
    if (cached && !searchQuery) {
      return cached
    }

    // Get concepts with frequency filtering
    const maxFrequency = await prisma.concept.findFirst({
      where: { userId },
      orderBy: { frequency: "desc" },
      select: { frequency: true },
    })

    const minFrequency = Math.max(1, Math.floor((abstractionLevel / 100) * (maxFrequency?.frequency || 1)))

    const whereClause: any = {
      userId,
      frequency: { gte: minFrequency },
    }

    if (searchQuery) {
      whereClause.name = {
        contains: searchQuery,
        mode: "insensitive",
      }
    }

    const concepts = await prisma.concept.findMany({
      where: whereClause,
      include: {
        fromRelationships: {
          include: { toConcept: true },
        },
      },
    })

    // Transform to graph format
    const nodes = concepts.map((concept) => ({
      id: concept.id,
      label: concept.name,
      type: concept.type,
      frequency: concept.frequency,
      density: this.calculateNodeDensity(concept.frequency, maxFrequency?.frequency || 1),
      description: concept.description,
    }))

    const edges = concepts.flatMap((concept) =>
      concept.fromRelationships.map((rel) => ({
        id: rel.id,
        source: rel.fromConceptId,
        target: rel.toConceptId,
        type: rel.type,
        weight: rel.strength,
      })),
    )

    const result = { nodes, edges }

    // Cache for 10 minutes if no search query
    if (!searchQuery) {
      await cacheService.set(cacheKey, result, 600)
    }

    return result
  }

  private async processConcepts(userId: string, contentId: string, entities: any[]) {
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

      // Create relationships between concepts in the same content
      const otherConcepts = await prisma.concept.findMany({
        where: {
          userId,
          name: { not: entity.name },
        },
      })

      for (const otherConcept of otherConcepts) {
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
      const cacheKey = cacheService.keys.userContent(userId, page)
      await cacheService.del(cacheKey)
    }
  }

  private async invalidateConceptMapCache(userId: string) {
    // Invalidate concept map cache for different abstraction levels
    for (let level = 0; level <= 100; level += 10) {
      const cacheKey = cacheService.keys.conceptMap(userId, level)
      await cacheService.del(cacheKey)
    }
  }
}

export const contentService = ContentService.getInstance()
