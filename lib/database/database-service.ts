// import { browserDatabase } from "./browser-database" // Removed: No longer using browserDatabase
import { contentRepository } from "./repositories/content-repository"
import { conceptRepository } from "./repositories/concept-repository"
import type { AnalysisEntity, ContentEntity, ConceptEntity } from "./schema" // Added ConceptEntity for typing

export class DatabaseService {
  private static instance: DatabaseService
  // private db = browserDatabase // Removed: No longer using browserDatabase
  private contentRepo = contentRepository
  private conceptRepo = conceptRepository

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  async storeAnalyzedContent(data: {
    title: string
    url: string
    content: string
    source: string
    analysis: {
      summary: {
        sentence: string
        paragraph: string
        isFullRead: boolean
      }
      entities: Array<{ name: string; type: string }>
      relationships: Array<{ from: string; to: string; type: string }>
      tags: string[]
      priority: "skim" | "read" | "deep-dive"
      fullContent?: string
      confidence?: number
    }
  }): Promise<{ contentId: string | null; analysisId: string | null; isNew: boolean }> {
    try {
      if (!data.title?.trim() || !data.url?.trim() || !data.content?.trim()) {
        throw new Error("Missing required content fields")
      }

      const normalizedUrl = this.normalizeUrl(data.url)
      const existingContent = await this.findContentByUrl(normalizedUrl)

      if (existingContent && existingContent.id) {
        console.log("Content already exists:", existingContent.title)
        const contentAnalysis = await this.contentRepo.getContentWithAnalysis(existingContent.id)
        return {
          contentId: existingContent.id,
          analysisId: contentAnalysis.analysis?.id || null,
          isNew: false,
        }
      }

      const contentId = await this.contentRepo.createContent({
        title: data.title.trim(),
        url: normalizedUrl,
        content: data.content,
        source: data.source,
      })

      if (!contentId) {
        throw new Error("Failed to create content record");
      }

      const analysisId = await this.contentRepo.createAnalysis({
        contentId, // Ensured this is not null
        summary: data.analysis.summary,
        entities: data.analysis.entities.map((e) => ({
          name: e.name.trim(),
          type: e.type as ConceptEntity["type"], // Cast to specific type
        })),
        relationships: data.analysis.relationships.map((r) => ({
          from: r.from.trim(),
          to: r.to.trim(),
          type: r.type as any, // Cast if RelationshipEntityType is defined
        })),
        tags: data.analysis.tags.filter((tag) => tag.trim()).map((tag) => tag.trim()),
        priority: data.analysis.priority,
        fullContent: data.analysis.fullContent,
        confidence: Math.max(0, Math.min(1, data.analysis.confidence || 0.8)),
      })

      if (!analysisId) {
        // Potentially rollback content creation or handle error
        console.warn(`Content ${contentId} created, but analysis failed.`)
        // Depending on desired behavior, you might throw or return partial success.
        // For now, returning null for analysisId to indicate failure.
      }

      return { contentId, analysisId, isNew: true }
    } catch (error) {
      console.error("Error storing analyzed content:", error)
      throw new Error(`Failed to store content: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source"]
      trackingParams.forEach((param) => urlObj.searchParams.delete(param))
      return urlObj.toString().replace(/\/$/, "").split("#")[0]
    } catch {
      return url.trim()
    }
  }

  private async findContentByUrl(url: string): Promise<ContentEntity | null> {
    try {
      // Assuming contentRepo.findByUrl or similar method exists. If not, adapt.
      // For now, using findAll and filtering, which is inefficient for large datasets.
      // Consider adding findByUrl to ContentRepository if this is a common operation.
      const allContent = await this.contentRepo.findAll()
      return allContent.find((content) => this.normalizeUrl(content.url) === url || content.url === url) || null
    } catch (error) {
      console.error("Error finding content by URL:", error)
      return null
    }
  }

  async getStoredContent(
    options: {
      limit?: number
      offset?: number
      source?: string
      priority?: string // This is on Analysis, so filtering might be complex
      timeframe?: "weekly" | "monthly" | "quarterly"
    } = {},
  ): Promise<{
    items: Array<{
      id: string
      title: string
      url: string
      contentSummary: string // Changed from full content for brevity
      analysis: {
        summaryText: string // Changed from full summary object
        entitiesSimplified: Array<{ name: string; type: string }> // Simplified
        tags: string[]
        priority: "skim" | "read" | "deep-dive"
      } | null // Analysis might be null
      createdAt: string
      source: string
    }>
    total: number // Total matching items before pagination
    hasMore: boolean
  }> {
    try {
      // Fetching all and then filtering/paginating can be inefficient.
      // Ideally, filters (source, priority, timeframe) and pagination (limit, offset)
      // should be pushed down to the Supabase query in contentRepository.
      // For now, adapting existing structure.

      let allContentWithAnalysis = await this.contentRepo.getAllWithAnalysis()

      // Apply filters
      if (options.source) {
        allContentWithAnalysis = allContentWithAnalysis.filter((r) => r.content.source === options.source)
      }
      if (options.priority && allContentWithAnalysis.length > 0) {
         allContentWithAnalysis = allContentWithAnalysis.filter(r => r.analysis && r.analysis.priority === options.priority);
      }
      if (options.timeframe) {
        const cutoffDate = this.getTimeframeCutoff(options.timeframe)
        allContentWithAnalysis = allContentWithAnalysis.filter((r) => new Date(r.content.createdAt) >= cutoffDate)
      }

      const total = allContentWithAnalysis.length
      const offset = options.offset || 0
      const limit = options.limit || 50
      const paginatedResults = allContentWithAnalysis.slice(offset, offset + limit)

      const items = await Promise.all(paginatedResults.map(async ({ content, analysis }) => {
        let relationshipDetails: Array<{ from: string; to: string; type: string }> = [];
        if (analysis && analysis.relationships) {
            relationshipDetails = await Promise.all(analysis.relationships.map(async (r) => {
                const fromConcept = r.fromConceptId ? await this.conceptRepo.findById(r.fromConceptId) : null;
                const toConcept = r.toConceptId ? await this.conceptRepo.findById(r.toConceptId) : null;
                return {
                    from: fromConcept?.name || "Unknown",
                    to: toConcept?.name || "Unknown",
                    type: r.type,
                };
            }));
        }

        return {
          id: content.id,
          title: content.title,
          url: content.url,
          contentSummary: content.content.substring(0, 200) + "...", // Example summary
          analysis: analysis ? {
            summaryText: analysis.summary.sentence,
            entitiesSimplified: analysis.entities.map(e => ({ name: e.name, type: e.type as string })),
            // relationships: relationshipDetails, // Decided to simplify and remove this for now from direct output
            tags: analysis.tags,
            priority: analysis.priority,
          } : null,
          createdAt: content.createdAt,
          source: content.source,
        };
      }));


      return {
        items,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      console.error("Error getting stored content:", error)
      return { items: [], total: 0, hasMore: false }
    }
  }


  private getTimeframeCutoff(timeframe: "weekly" | "monthly" | "quarterly"): Date {
    const now = new Date()
    const cutoffDate = new Date()
    switch (timeframe) {
      case "weekly": cutoffDate.setDate(now.getDate() - 7); break
      case "monthly": cutoffDate.setMonth(now.getMonth() - 1); break
      case "quarterly": cutoffDate.setMonth(now.getMonth() - 3); break
    }
    return cutoffDate
  }

  async getConceptMapData(abstractionLevel = 50, searchQuery = "") {
    try {
      const maxFrequency = await this.getMaxConceptFrequency()
      const minFrequency = Math.max(1, Math.floor((abstractionLevel / 100) * maxFrequency))
      const graphData = await this.conceptRepo.getConceptGraph(minFrequency)

      if (!graphData || !graphData.nodes) {
        return { nodes: [], edges: [] }
      }

      let filteredNodes = graphData.nodes
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filteredNodes = filteredNodes.filter(
          (node) =>
            node.name?.toLowerCase().includes(query) ||
            node.description?.toLowerCase().includes(query) ||
            (node.type as string)?.toLowerCase().includes(query) ||
            this.fuzzyMatch(node.name?.toLowerCase() || "", query),
        )
      }

      const nodeIds = new Set(filteredNodes.map((node) => node.id))
      const filteredEdges = (graphData.edges || []).filter(
        (edge) =>
          edge.fromConceptId && edge.toConceptId && nodeIds.has(edge.fromConceptId) && nodeIds.has(edge.toConceptId),
      )

      return {
        nodes: filteredNodes.map((node) => ({
          id: node.id || `node-${Math.random()}`,
          label: node.name || "Unknown",
          type: node.type as string || "concept",
          density: this.calculateNodeDensity(node.frequency || 0, maxFrequency),
          description: node.description || "",
          frequency: node.frequency || 0,
        })),
        edges: filteredEdges.map((edge) => ({
          id: edge.id || `edge-${Math.random()}`,
          source: edge.fromConceptId,
          target: edge.toConceptId,
          type: edge.type || "co_occurs",
          weight: Math.max(0, Math.min(1, edge.weight || 0.5)),
        })),
      }
    } catch (error) {
      console.error("Error getting concept map data:", error)
      return { nodes: [], edges: [] }
    }
  }

  private async getMaxConceptFrequency(): Promise<number> {
    try {
      const stats = await this.conceptRepo.getConceptStats()
      return Math.max(1, stats.topConcepts[0]?.frequency || 1)
    } catch (error) {
      console.error("Error getting max concept frequency:", error)
      return 1
    }
  }

  private calculateNodeDensity(frequency: number, maxFrequency: number): number {
    if (maxFrequency <= 1) return 50
    return Math.min(100, Math.max(10, (frequency / maxFrequency) * 100))
  }

  private fuzzyMatch(text: string, query: string): boolean {
    if (query.length < 3) return false
    const words = text.split(/\s+/)
    return words.some((word) => {
      if (word.length < query.length) return false
      let matches = 0
      let queryIndex = 0
      for (let i = 0; i < word.length && queryIndex < query.length; i++) {
        if (word[i] === query[queryIndex]) {
          matches++
          queryIndex++
        }
      }
      return matches >= Math.floor(query.length * 0.8)
    })
  }

  async getConceptDetails(conceptId: string) {
    try {
      return await this.conceptRepo.getConceptDetails(conceptId)
    } catch (error) {
      console.error("Error getting concept details:", error)
      return { concept: null, relatedConcepts: [], articles: [], relationshipStats: { incoming: 0, outgoing: 0, types: {} } }
    }
  }

  async searchConcepts(query: string) {
    try {
      const results = await this.conceptRepo.searchConcepts(query)
      return results.slice(0, 10)
    } catch (error) {
      console.error("Error searching concepts:", error)
      return []
    }
  }

  async getTrendingConcepts(timeframe: "weekly" | "monthly" | "quarterly") {
    try {
      return await this.conceptRepo.getTrendingConcepts(timeframe)
    } catch (error) {
      console.error("Error getting trending concepts:", error)
      return []
    }
  }

  async searchContent(
    query: string,
    options: {
      limit?: number
      sources?: string[]
      priorities?: string[]
      dateRange?: { start: Date; end: Date }
    } = {},
  ): Promise<Array<{
    id: string
    title: string
    url: string
    analysis: { summary: { sentence: string }; tags: string[] } | null // Analysis can be null
    createdAt: string
    relevanceScore: number
  }>> {
    try {
      const contents = await this.contentRepo.searchContent(query)
      let results = await Promise.all(contents.map(async (content) => {
        const { analysis } = await this.contentRepo.getContentWithAnalysis(content.id)
        const titleMatch = content.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 0
        const contentMatch = content.content.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        const tagMatch = analysis?.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())) ? 1.5 : 0
        return {
          id: content.id,
          title: content.title,
          url: content.url,
          analysis: analysis ? { summary: { sentence: analysis.summary.sentence }, tags: analysis.tags } : null,
          createdAt: content.createdAt,
          relevanceScore: titleMatch + contentMatch + tagMatch,
        }
      }))

      if (options.sources?.length) {
        const sourceSet = new Set(options.sources)
        results = (await Promise.all(results.map(async r => {
            const contentDetails = await this.contentRepo.findById(r.id);
            return contentDetails && sourceSet.has(contentDetails.source) ? r : null;
        }))).filter(r => r !== null) as typeof results;
      }

      if (options.priorities?.length) {
        const prioritySet = new Set(options.priorities);
        results = (await Promise.all(results.map(async r => {
            if (!r.id) return null; // Should not happen if IDs are always present
            const { analysis: analysisDetails } = await this.contentRepo.getContentWithAnalysis(r.id);
            return analysisDetails && prioritySet.has(analysisDetails.priority) ? r : null;
        }))).filter(r => r !== null) as typeof results;
      }

      if (options.dateRange) {
        results = results.filter((r) => {
          const date = new Date(r.createdAt)
          return date >= options.dateRange!.start && date <= options.dateRange!.end
        })
      }
      results.sort((a, b) => b.relevanceScore - a.relevanceScore)
      return results.slice(0, options.limit || 20)
    } catch (error) {
      console.error("Error searching content:", error)
      return []
    }
  }

  async deleteContent(id: string): Promise<boolean> {
    try {
      return await this.contentRepo.deleteContent(id)
    } catch (error) {
      console.error("Error deleting content:", error)
      return false
    }
  }

  async getContentByTimeframe(timeframe: "weekly" | "monthly" | "quarterly") {
    try {
      const contents = await this.contentRepo.findByTimeframe(timeframe)
      const results: Array<{
        id: string
        title: string
        url: string
        analysis: AnalysisEntity | null // Analysis can be null
        createdAt: string
      }> = []

      for (const content of contents) {
        if (!content.id) continue; // Skip if no ID
        const { analysis } = await this.contentRepo.getContentWithAnalysis(content.id)
        results.push({
          id: content.id,
          title: content.title,
          url: content.url,
          analysis,
          createdAt: content.createdAt,
        })
      }
      return results
    } catch (error) {
      console.error("Error getting content by timeframe:", error)
      return []
    }
  }

  // Methods like vacuum, backup, restore, clear, getTableStats, getTotalRecords
  // were dependent on browserDatabase and are removed as Supabase handles these aspects.
  // getDatabaseStats, healthCheck will need significant rework if similar functionality is needed from Supabase.

  async getApplicationStats() {
    try {
      const contentStats = await this.contentRepo.getStats();
      const conceptStats = await this.conceptRepo.getConceptStats();
      // Removed parts dependent on browserDatabase

      // Simplified recent content count
      const recentContentWeekly = await this.contentRepo.findByTimeframe("weekly");

      // Growth rate and top sources can be complex with Supabase without direct SQL or more specific repo methods
      // Placeholder or simplified logic:
      const topSourcesAggregated: Record<string, number> = {};
      const allContent = await this.contentRepo.findAll();
      allContent.forEach(c => {
          topSourcesAggregated[c.source] = (topSourcesAggregated[c.source] || 0) + 1;
      });
      const topSources = Object.entries(topSourcesAggregated)
          .sort(([,a],[,b]) => b-a)
          .slice(0,5)
          .map(([source, count]) => ({ source, count, percentage: (count / allContent.length) * 100 }));


      return {
        content: {
          totalContent: contentStats.totalContent,
          bySource: contentStats.bySource, // From repo, might be different from topSourcesAggregated
          recentCount: recentContentWeekly.length,
          topSources,
          // growthRate: complex to calculate accurately without more historical data or specific queries
        },
        concepts: {
          totalConcepts: conceptStats.totalConcepts,
          byType: conceptStats.byType,
          topConcepts: conceptStats.topConcepts,
          averageFrequency: conceptStats.averageFrequency,
          // growthTrend: complex
        },
        // Removed tableStats, totalRecords from browserDatabase
        // Performance metrics would need different calculation methods
      };
    } catch (error) {
      console.error("Error getting application stats:", error);
      return {
        content: { totalContent: 0, bySource: {}, recentCount: 0, topSources: [] },
        concepts: { totalConcepts: 0, byType: {}, topConcepts: [], averageFrequency: 0 },
      };
    }
  }

  // exportData might need to fetch data differently, e.g., paginating through getStoredContent
  // For simplicity, it's adapted but might be slow for very large datasets.
  async exportData(format: "json" | "csv" = "json"): Promise<string> {
    try {
      // Fetching all data for export; consider chunking for large datasets
      const allData = await this.getStoredContent({ limit: 100000 }); // High limit, adjust as needed

      if (format === "csv") {
        return this.convertToCSV(allData.items);
      }

      const appStats = await this.getApplicationStats();

      return JSON.stringify(
        {
          version: "2.0.0-supabase",
          exportedAt: new Date().toISOString(),
          content: allData.items,
          stats: appStats, // Using new getApplicationStats
        },
        null,
        2,
      );
    } catch (error) {
      console.error("Error exporting data:", error);
      throw new Error("Failed to export data");
    }
  }

   private convertToCSV(items: any[]): string {
    if (items.length === 0) return ""
    // Adjust headers and row mapping based on the new structure of items from getStoredContent
    const headers = ["Title", "URL", "Summary", "Priority", "Tags", "Created", "Source"]
    const rows = items.map((item) => {
        const analysisSummary = item.analysis?.summaryText || "";
        const analysisPriority = item.analysis?.priority || "";
        const analysisTags = item.analysis?.tags?.join(", ") || "";
        return [
            `"${item.title?.replace(/"/g, '""') || ""}"`,
            `"${item.url || ""}"`,
            `"${analysisSummary.replace(/"/g, '""')}"`,
            analysisPriority,
            `"${analysisTags}"`,
            item.createdAt || "",
            item.source || "",
        ];
    });
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  // Health check needs to be re-evaluated for Supabase.
  // It might involve checking Supabase client status or making a simple query.
  async healthCheck(): Promise<{
    status: "healthy" | "error";
    checks: Record<string, boolean>;
    issues: string[];
  }> {
    const checks: Record<string, boolean> = { supabaseConnection: false };
    const issues: string[] = [];
    try {
      // Simple check: try to fetch a small piece of data or Supabase status
      await this.conceptRepo.findAll(); // Example: check if we can fetch concepts
      checks.supabaseConnection = true;
      return { status: "healthy", checks, issues };
    } catch (error) {
      console.error("Health check failed:", error);
      issues.push(error instanceof Error ? error.message : "Supabase connection error");
      return { status: "error", checks, issues };
    }
  }


  getVersion(): string {
    return "2.0.0-supabase"; // Updated version string
  }

  // Migration logic might change based on how migrations are handled with Supabase (e.g., SQL migration files)
  // This client-side migration might be less relevant or need to coordinate with DB migrations.
  async migrate(fromVersion: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`Migrating from ${fromVersion} to ${this.getVersion()}`);
      // Actual migration logic for client-side concerns, if any, would go here.
      // E.g., clearing local cache that might be incompatible.
      // For database schema changes, Supabase's migration system is preferred.
      return { success: true, message: "Client-side migration aspects checked (if any)." };
    } catch (error) {
      console.error("Client-side migration failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Client-side migration failed",
      };
    }
  }
}

export const databaseService = DatabaseService.getInstance()
