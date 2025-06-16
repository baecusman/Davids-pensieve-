import { browserDatabase } from "./browser-database"
import { cacheManager } from "../cache-manager"
import { performanceMonitor } from "../performance-monitor"
import type { ContentEntity, ConceptEntity } from "./schema"

class OptimizedDatabase {
  private static instance: OptimizedDatabase
  private db = browserDatabase
  private batchQueue: Array<() => Promise<any>> = []
  private batchTimeout: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 10
  private readonly BATCH_DELAY = 100 // ms

  static getInstance(): OptimizedDatabase {
    if (!OptimizedDatabase.instance) {
      OptimizedDatabase.instance = new OptimizedDatabase()
    }
    return OptimizedDatabase.instance
  }

  // Cached queries with performance monitoring
  async getContentWithCache(id: string): Promise<ContentEntity | null> {
    const cacheKey = `content:${id}`

    // Check cache first
    const cached = cacheManager.get<ContentEntity>(cacheKey)
    if (cached) return cached

    const timer = performanceMonitor.startTimer("db-query")

    try {
      const content = this.db.findById<ContentEntity>("content", id)
      if (content) {
        cacheManager.set(cacheKey, content, 10 * 60 * 1000) // 10 minutes
      }
      return content
    } finally {
      timer()
    }
  }

  // Batch operations for better performance
  async batchInsert<T>(tableName: string, entities: T[]): Promise<string[]> {
    const timer = performanceMonitor.startTimer("db-query")
    const ids: string[] = []

    try {
      // Process in chunks to avoid blocking
      for (let i = 0; i < entities.length; i += this.BATCH_SIZE) {
        const chunk = entities.slice(i, i + this.BATCH_SIZE)

        for (const entity of chunk) {
          const id = this.db.insert(tableName as any, entity)
          ids.push(id)
        }

        // Yield control to prevent blocking
        if (i + this.BATCH_SIZE < entities.length) {
          await new Promise((resolve) => setTimeout(resolve, 0))
        }
      }

      return ids
    } finally {
      timer()
    }
  }

  // Optimized search with caching and pagination
  async searchWithPagination(
    query: string,
    options: {
      limit?: number
      offset?: number
      tableName: string
      fields: string[]
    },
  ): Promise<{ items: any[]; total: number; hasMore: boolean }> {
    const cacheKey = `search:${query}:${options.tableName}:${options.offset || 0}:${options.limit || 20}`

    // Check cache
    const cached = cacheManager.get<{ items: any[]; total: number; hasMore: boolean }>(cacheKey)
    if (cached) return cached

    const timer = performanceMonitor.startTimer("db-query")

    try {
      const allResults = this.db.search(options.tableName as any, query, options.fields)
      const total = allResults.length
      const offset = options.offset || 0
      const limit = options.limit || 20

      const items = allResults.slice(offset, offset + limit)
      const hasMore = offset + limit < total

      const result = { items, total, hasMore }

      // Cache for 2 minutes
      cacheManager.set(cacheKey, result, 2 * 60 * 1000)

      return result
    } finally {
      timer()
    }
  }

  // Optimized concept map data with aggressive caching
  async getConceptMapData(abstractionLevel: number, searchQuery: string) {
    const cacheKey = `conceptmap:${abstractionLevel}:${searchQuery}`

    // Check cache first (longer TTL for expensive operations)
    const cached = cacheManager.get(cacheKey)
    if (cached) return cached

    const timer = performanceMonitor.startTimer("db-query")

    try {
      // Get all concepts
      const concepts = this.db.findAll<ConceptEntity>("concepts")

      // Apply abstraction filtering
      const maxFreq = Math.max(...concepts.map((c) => c.frequency || 0), 1)
      const minFreq = Math.ceil((abstractionLevel / 100) * maxFreq)

      let filteredConcepts = concepts.filter((c) => (c.frequency || 0) >= minFreq)

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filteredConcepts = filteredConcepts.filter(
          (c) => c.name?.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query),
        )
      }

      // Get relationships for filtered concepts
      const conceptIds = new Set(filteredConcepts.map((c) => c.id))
      const relationships = this.db
        .findAll("relationships")
        .filter((rel: any) => conceptIds.has(rel.fromConceptId) && conceptIds.has(rel.toConceptId))

      const result = {
        nodes: filteredConcepts.map((concept) => ({
          id: concept.id,
          label: concept.name || "Unknown",
          type: concept.type || "concept",
          density: Math.min(100, ((concept.frequency || 0) / maxFreq) * 100),
          frequency: concept.frequency || 0,
          description: concept.description,
          source: "analyzed" as const,
        })),
        edges: relationships.map((rel: any) => ({
          id: rel.id,
          source: rel.fromConceptId,
          target: rel.toConceptId,
          type: rel.type || "relates_to",
          weight: rel.weight || 0.5,
        })),
      }

      // Cache for 5 minutes (expensive operation)
      cacheManager.set(cacheKey, result, 5 * 60 * 1000)

      return result
    } finally {
      timer()
    }
  }

  // Invalidate related caches when data changes
  invalidateCache(pattern: string): void {
    // Simple pattern matching for cache invalidation
    const keys = Array.from((cacheManager as any).cache.keys())
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        cacheManager.delete(key)
      }
    })
  }

  // Optimized bulk operations
  async bulkUpdate(tableName: string, updates: Array<{ id: string; data: any }>): Promise<boolean[]> {
    const timer = performanceMonitor.startTimer("db-query")
    const results: boolean[] = []

    try {
      for (const update of updates) {
        const result = this.db.update(tableName as any, update.id, update.data)
        results.push(result)
      }

      // Invalidate related caches
      this.invalidateCache(tableName)

      return results
    } finally {
      timer()
    }
  }

  // Health check with performance metrics
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "error"
    metrics: any
    issues: string[]
  }> {
    const timer = performanceMonitor.startTimer("db-query")
    const issues: string[] = []

    try {
      const totalRecords = this.db.getTotalRecords()
      const cacheStats = cacheManager.getStats()
      const perfMetrics = performanceMonitor.getMetrics()

      // Check for performance issues
      if (perfMetrics.dbQueryTime > 100) {
        issues.push("Database queries are slow")
      }

      if (cacheStats.hitRate < 0.5) {
        issues.push("Low cache hit rate")
      }

      if (totalRecords > 10000) {
        issues.push("Large dataset may impact performance")
      }

      const status = issues.length === 0 ? "healthy" : issues.length < 3 ? "degraded" : "error"

      return {
        status,
        metrics: {
          totalRecords,
          cacheStats,
          perfMetrics,
        },
        issues,
      }
    } finally {
      timer()
    }
  }

  // Cleanup and optimization
  async optimize(): Promise<{ cleaned: number; optimized: number }> {
    const timer = performanceMonitor.startTimer("db-query")

    try {
      // Clear expired cache entries
      cacheManager.clear()

      // Run database vacuum
      const vacuumResult = this.db.vacuum()

      // Rebuild indexes if needed
      // (This would be implemented based on your indexing strategy)

      return {
        cleaned: vacuumResult.cleaned,
        optimized: 1,
      }
    } finally {
      timer()
    }
  }
}

export const optimizedDatabase = OptimizedDatabase.getInstance()
