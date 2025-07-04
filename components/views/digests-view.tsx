"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import DigestContentItem from "../digest-content-item"
import FullReadModal from "../full-read-modal"
import LoadingSkeleton from "../loading-skeleton"
import { ContentProcessor } from "@/lib/content-processor"
import { performanceMonitor } from "@/lib/performance-monitor"
import { cacheManager } from "@/lib/cache-manager"
import ErrorBoundary from "../error-boundary"

export default function DigestsView() {
  const [activeDigestType, setActiveDigestType] = useState<"weekly" | "monthly" | "quarterly">("weekly")
  const [selectedFullRead, setSelectedFullRead] = useState<{
    title: string
    content: string
    url?: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState("")
  const [generatedDigest, setGeneratedDigest] = useState<any>(null)
  const [realContentCount, setRealContentCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [storedContent, setStoredContent] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null) // Added error state

  // Memoized content loading with caching
  const loadContentData = useCallback(async () => {
    setIsLoading(true) // Set loading true at the start of fetch
    setError(null) // Clear previous errors
    const cacheKey = `digest-content:${activeDigestType}`

    // Check cache first
    const cached = cacheManager.get<{ content: any[]; count: number }>(cacheKey)
    if (cached) {
      setStoredContent(cached.content)
      setRealContentCount(cached.count)
      setIsLoading(false)
      return
    }

    const timer = performanceMonitor.startTimer("db-query")

    try {
      // ContentProcessor.getStoredContent is now async
      const resultItems = await ContentProcessor.getStoredContent({
        limit: 100,
        timeframe: activeDigestType,
      })

      // getStoredContent now directly returns items array as per its last refactor
      // or it returns an object { items, total, hasMore } if we use databaseService.getStoredContent directly
      // Assuming ContentProcessor.getStoredContent was updated to return items directly for this view's existing logic
      const content = Array.isArray(resultItems) ? resultItems : [] // Ensure content is an array
      const count = content.length // Count based on the items received

      setStoredContent(content)
      setRealContentCount(count)

      // Cache for 5 minutes
      if (content.length > 0) { // Only cache if we got some content
        cacheManager.set(cacheKey, { content, count }, 5 * 60 * 1000)
      }
    } catch (err: any) {
      console.error("Error loading content data:", err)
      setError(`Failed to load digest content: ${err.message || "Unknown error"}`)
      performanceMonitor.recordError()
      setStoredContent([]) // Clear content on error
      setRealContentCount(0)
    } finally {
      setIsLoading(false)
      timer()
    }
  }, [activeDigestType])

  // Debounced loading
  useEffect(() => {
    const timeoutId = setTimeout(loadContentData, 100)
    return () => clearTimeout(timeoutId)
  }, [loadContentData])

  // Memoized event handlers
  const handleTagClick = useCallback((tag: string) => {
    console.log("Tag clicked:", tag)
    // TODO: Filter concept map or highlight related concepts
  }, [])

  const handleFullReadClick = useCallback((item: any) => {
    setSelectedFullRead({
      title: item.title,
      content: item.fullContent || item.content || "Full content would be loaded here...",
      url: item.url,
    })
  }, [])

  // Optimized digest generation
  const handleGenerate = useCallback(async () => {
    if (isGenerating) return

    setIsGenerating(true)
    setGenerationStatus("Gathering content from database...")

    const timer = performanceMonitor.startTimer("api-call")

    try {
      if (storedContent.length === 0) {
        setGenerationStatus("No analyzed content found. Please add some sources and analyze content first.")
        setTimeout(() => setGenerationStatus(""), 5000)
        return
      }

      setGenerationStatus(`Found ${storedContent.length} analyzed articles in database...`)

      // Convert stored content to digest format
      const digestItems = storedContent.map((article) => ({
        title: article.title,
        summary: article.analysis?.summary?.sentence || article.summary || "No summary available",
        fullSummary: article.analysis?.summary?.paragraph || article.fullSummary || "",
        summaryType: article.analysis?.summary?.isFullRead ? ("full-read" as const) : ("paragraph" as const),
        priority: article.analysis?.priority || article.priority || "read",
        url: article.url,
        conceptTags: article.analysis?.tags || article.conceptTags || [],
        analyzedAt: article.createdAt || article.analyzedAt || new Date().toISOString(),
        fullContent: article.analysis?.fullContent || article.fullContent || "",
        source: "analyzed",
      }))

      setGenerationStatus(`Generating ${activeDigestType} digest with ${digestItems.length} articles using Grok...`)

      const digest = await ContentProcessor.generateDigest(activeDigestType, digestItems)

      setGenerationStatus(`✅ Generated comprehensive digest with ${digest.items.length} articles!`)
      setGeneratedDigest(digest)

      // Cache the generated digest
      cacheManager.set(`generated-digest:${activeDigestType}`, digest, 30 * 60 * 1000) // 30 minutes

      console.log("Generated comprehensive digest:", digest)

      setTimeout(() => setGenerationStatus(""), 5000)
    } catch (error) {
      console.error("Error generating digest:", error)
      performanceMonitor.recordError()
      setGenerationStatus("❌ Error generating digest. Please try again.")
      setTimeout(() => setGenerationStatus(""), 3000)
    } finally {
      setIsGenerating(false)
      timer()
    }
  }, [isGenerating, storedContent, activeDigestType])

  // Memoized content items for performance
  const contentItems = useMemo(() => {
    return storedContent
      .slice(0, 10)
      .map((item, index) => (
        <DigestContentItem
          key={`${item.id}-${index}`}
          title={item.title}
          summary={item.analysis?.summary?.sentence || item.summary || "No summary available"}
          fullSummary={item.analysis?.summary?.paragraph || item.fullSummary}
          summaryType={item.analysis?.summary?.isFullRead ? "full-read" : "paragraph"}
          priority={item.analysis?.priority || item.priority || "read"}
          isNew={false}
          url={item.url}
          conceptTags={item.analysis?.tags || item.conceptTags || []}
          onTagClick={handleTagClick}
          onFullReadClick={() => handleFullReadClick(item)}
        />
      ))
  }, [storedContent, handleTagClick, handleFullReadClick])

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Placeholder for navigation/header part of the skeleton */}
        <LoadingSkeleton height={60} className="mb-8" />
        {/* Skeleton for content list */}
        <LoadingSkeleton height={40} width="70%" className="mb-4" />
        <LoadingSkeleton count={3} height={80} className="mb-4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Digests</h2>
        <p className="text-gray-700 mb-4">{error}</p>
        <button
          onClick={loadContentData}
          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Navigation with Generate button */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || storedContent.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg transform hover:scale-105 whitespace-nowrap disabled:transform-none disabled:shadow-none"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>

          <div style={{ width: "5px" }} />

          <div className="flex bg-gray-100 rounded-lg p-1 flex-1">
            {(["weekly", "monthly", "quarterly"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setActiveDigestType(type)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium capitalize transition-all duration-200 ${
                  activeDigestType === type ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Generation Status */}
        {generationStatus && (
          <div
            className={`mb-6 p-3 rounded-lg border ${
              generationStatus.includes("❌")
                ? "bg-red-50 border-red-200 text-red-800"
                : generationStatus.includes("✅")
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <p className="text-sm">{generationStatus}</p>
          </div>
        )}

        {/* Generated Digest Summary */}
        {generatedDigest && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                🤖 AI-Generated {generatedDigest.timeframe.charAt(0).toUpperCase() + generatedDigest.timeframe.slice(1)}{" "}
                Digest
              </h3>
              <span className="text-xs text-gray-500">
                Generated {new Date(generatedDigest.generatedAt).toLocaleString()}
              </span>
            </div>

            <div className="prose prose-sm max-w-none mb-4">
              <p className="text-gray-700 leading-relaxed">{generatedDigest.summary}</p>
            </div>

            {/* Trending Concepts */}
            {generatedDigest.trendingConcepts && generatedDigest.trendingConcepts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">🔥 Trending Concepts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {generatedDigest.trendingConcepts.slice(0, 4).map((concept: any, index: number) => (
                    <div key={index} className="bg-white p-3 rounded border border-blue-100">
                      <h5 className="font-medium text-blue-900 text-sm">{concept.name}</h5>
                      <p className="text-xs text-gray-600 mt-1">{concept.reason}</p>
                      <p className="text-xs text-blue-700 mt-1 font-medium">{concept.importance}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <span>📊 {generatedDigest.stats.totalArticles} total articles</span>
              <span>🎯 {generatedDigest.stats.deepDiveCount} deep-dive</span>
              <span>📖 {generatedDigest.stats.readCount} read</span>
              <span>👁️ {generatedDigest.stats.skimCount} skim</span>
              {generatedDigest.stats.analyzedArticles && (
                <span className="text-blue-600">🔍 {generatedDigest.stats.analyzedArticles} from your content</span>
              )}
            </div>
          </div>
        )}

        {/* Content Status and Display Logic */}
        {!isLoading && !error && storedContent.length === 0 && !generatedDigest && (
           <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
             <div className="flex items-center gap-2 text-amber-800">
               <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
               <span className="text-sm font-medium">
                 No analyzed content found for this period. Add sources and analyze content to generate digests.
               </span>
             </div>
           </div>
        )}

        {!isLoading && !error && storedContent.length > 0 && (
          <>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm font-medium">
                  Displaying {storedContent.length} analyzed articles for potential digest generation.
                </span>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Your Analyzed Content (Preview)</h3>
              <div className="space-y-2">{contentItems}</div>
              {storedContent.length > 10 && (
                <p className="text-sm text-gray-600 text-center">
                  Showing first 10 of {storedContent.length} analyzed articles
                </p>
              )}
            </div>
          </>
        )}


        {/* Full Read Modal */}
        <FullReadModal
          isOpen={!!selectedFullRead}
          onClose={() => setSelectedFullRead(null)}
          title={selectedFullRead?.title || ""}
          content={selectedFullRead?.content || ""}
          url={selectedFullRead?.url}
        />
      </div>
    </ErrorBoundary>
  )
}
