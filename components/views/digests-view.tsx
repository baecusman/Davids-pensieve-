"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import DigestContentItem from "../digest-content-item"
import DigestWeekSection from "../digest-week-section"
import DigestMonthSection from "../digest-month-section"
import DigestQuarterSection from "../digest-quarter-section"
import FullReadModal from "../full-read-modal"
import LoadingSkeleton from "../loading-skeleton"
import { ContentProcessor } from "@/lib/content-processor"
import { performanceMonitor } from "@/lib/performance-monitor"
import { cacheManager } from "@/lib/cache-manager"
import ErrorBoundary from "../error-boundary"
import { Calendar, TrendingUp, BookOpen, Clock } from "lucide-react"

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

  // Load content data
  const loadContentData = useCallback(async () => {
    const cacheKey = `digest-content:${activeDigestType}`

    // Check cache first
    const cached = cacheManager.get<{ content: any[]; count: number }>(cacheKey)
    if (cached) {
      setStoredContent(cached.content)
      setRealContentCount(cached.count)
      setIsLoading(false)
      return
    }

    const timer = performanceMonitor.startTimer("content-load")

    try {
      // Get content from ContentProcessor
      const content = ContentProcessor.getStoredContent({
        limit: 100,
        timeframe: activeDigestType,
      })

      console.log("Loaded content for digests:", content.length, "items")

      const count = content.length

      setStoredContent(content)
      setRealContentCount(count)

      // Cache for 5 minutes
      cacheManager.set(cacheKey, { content, count }, 5 * 60 * 1000)
    } catch (error) {
      console.error("Error loading content data:", error)
      performanceMonitor.recordError()
      setStoredContent([])
      setRealContentCount(0)
    } finally {
      setIsLoading(false)
      timer()
    }
  }, [activeDigestType])

  // Load content when component mounts or digest type changes
  useEffect(() => {
    const timeoutId = setTimeout(loadContentData, 100)
    return () => clearTimeout(timeoutId)
  }, [loadContentData])

  // Event handlers
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

  // Generate digest
  const handleGenerate = useCallback(async () => {
    if (isGenerating) return

    setIsGenerating(true)
    setGenerationStatus("Gathering content from database...")

    const timer = performanceMonitor.startTimer("digest-generation")

    try {
      // Refresh content data first
      await loadContentData()

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
  }, [isGenerating, storedContent, activeDigestType, loadContentData])

  // Group content by time periods
  const groupedContent = useMemo(() => {
    if (storedContent.length === 0) return {}

    const groups: Record<string, any[]> = {}
    const now = new Date()

    storedContent.forEach((item) => {
      const createdDate = new Date(item.createdAt)
      let key: string

      if (activeDigestType === "weekly") {
        // Group by week
        const weekStart = new Date(createdDate)
        weekStart.setDate(createdDate.getDate() - createdDate.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        key = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
      } else if (activeDigestType === "monthly") {
        // Group by month
        key = createdDate.toLocaleDateString("en-US", { year: "numeric", month: "long" })
      } else {
        // Group by quarter
        const quarter = Math.floor(createdDate.getMonth() / 3) + 1
        key = `Q${quarter} ${createdDate.getFullYear()}`
      }

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
    })

    return groups
  }, [storedContent, activeDigestType])

  // Content items for display
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Content Digests</h1>
          </div>
          <p className="text-gray-600">AI-generated summaries and insights from your analyzed content</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Total Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{realContentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {ContentProcessor.getContentStats().byTimeframe["last-week"]}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Deep Dives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {ContentProcessor.getContentStats().byPriority["deep-dive"]}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Priority Read</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {ContentProcessor.getContentStats().byPriority["read"]}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Digest Interface */}
        <Tabs
          value={activeDigestType}
          onValueChange={(value) => setActiveDigestType(value as any)}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
            </TabsList>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || storedContent.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isGenerating
                ? "Generating..."
                : `Generate ${activeDigestType.charAt(0).toUpperCase() + activeDigestType.slice(1)} Digest`}
            </Button>
          </div>

          {/* Generation Status */}
          {generationStatus && (
            <div
              className={`p-3 rounded-lg border ${
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
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🤖 AI-Generated{" "}
                  {generatedDigest.timeframe.charAt(0).toUpperCase() + generatedDigest.timeframe.slice(1)} Digest
                </CardTitle>
                <CardDescription>Generated {new Date(generatedDigest.generatedAt).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed">{generatedDigest.summary}</p>
                </div>

                {/* Trending Concepts */}
                {generatedDigest.trendingConcepts && generatedDigest.trendingConcepts.length > 0 && (
                  <div>
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
              </CardContent>
            </Card>
          )}

          {/* Content Status */}
          {realContentCount > 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm font-medium">
                  You have {realContentCount} analyzed articles ready for digest generation.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800">
                <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                <span className="text-sm font-medium">
                  No analyzed content found. Add some sources in Source Management and analyze content to generate
                  personalized digests.
                </span>
              </div>
            </div>
          )}

          {/* Digest Content by Time Period */}
          <TabsContent value="weekly" className="space-y-4">
            {Object.keys(groupedContent).length > 0 ? (
              Object.entries(groupedContent)
                .sort(([a], [b]) => new Date(b.split(" - ")[0]).getTime() - new Date(a.split(" - ")[0]).getTime())
                .map(([period, items]) => {
                  const [weekStart, weekEnd] = period.split(" - ")
                  const isCurrentWeek = new Date(weekStart) <= new Date() && new Date() <= new Date(weekEnd)

                  return (
                    <DigestWeekSection
                      key={period}
                      weekStart={weekStart}
                      weekEnd={weekEnd}
                      summary={`Week containing ${items.length} analyzed articles`}
                      isCurrentWeek={isCurrentWeek}
                      itemCount={items.length}
                    >
                      <div className="space-y-2">
                        {items.map((item, index) => (
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
                        ))}
                      </div>
                    </DigestWeekSection>
                  )
                })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No content available for weekly digest. Start analyzing some articles!
              </div>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            {Object.keys(groupedContent).length > 0 ? (
              Object.entries(groupedContent)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([period, items]) => {
                  const isCurrentMonth =
                    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" }) === period

                  return (
                    <DigestMonthSection
                      key={period}
                      month={period}
                      summary={`Month containing ${items.length} analyzed articles`}
                      isCurrentMonth={isCurrentMonth}
                      itemCount={items.length}
                    >
                      <div className="space-y-2">
                        {items.map((item, index) => (
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
                        ))}
                      </div>
                    </DigestMonthSection>
                  )
                })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No content available for monthly digest. Start analyzing some articles!
              </div>
            )}
          </TabsContent>

          <TabsContent value="quarterly" className="space-y-4">
            {Object.keys(groupedContent).length > 0 ? (
              Object.entries(groupedContent)
                .sort(([a], [b]) => {
                  const [aQ, aYear] = a.split(" ")
                  const [bQ, bYear] = b.split(" ")
                  return (
                    Number.parseInt(bYear) - Number.parseInt(aYear) ||
                    Number.parseInt(bQ.slice(1)) - Number.parseInt(aQ.slice(1))
                  )
                })
                .map(([period, items]) => {
                  const [quarter, year] = period.split(" ")
                  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1
                  const currentYear = new Date().getFullYear()
                  const isCurrentQuarter = `Q${currentQuarter} ${currentYear}` === period

                  return (
                    <DigestQuarterSection
                      key={period}
                      quarter={period}
                      summary={`Quarter containing ${items.length} analyzed articles`}
                      isCurrentQuarter={isCurrentQuarter}
                      itemCount={items.length}
                    >
                      <div className="space-y-2">
                        {items.map((item, index) => (
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
                        ))}
                      </div>
                    </DigestQuarterSection>
                  )
                })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No content available for quarterly digest. Start analyzing some articles!
              </div>
            )}
          </TabsContent>
        </Tabs>

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
