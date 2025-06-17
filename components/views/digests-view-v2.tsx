"use client"

import { useState, useEffect } from "react"
import { useApi } from "@/lib/hooks/use-api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, ExternalLink, RefreshCw, TrendingUp, BookOpen, Eye, Zap } from "lucide-react"

interface ContentItem {
  id: string
  title: string
  url: string
  content: string
  source: string
  createdAt: string
  analysis: {
    summary: {
      sentence: string
      paragraph: string
      isFullRead: boolean
    }
    tags: string[]
    priority: "SKIM" | "READ" | "DEEP_DIVE"
  } | null
}

interface ContentResponse {
  items: ContentItem[]
  total: number
  hasMore: boolean
  page: number
  totalPages: number
}

export default function DigestsViewV2() {
  const { apiCall } = useApi()
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState({
    timeframe: "",
    priority: "",
    source: "",
  })

  const loadContent = async (pageNum = 1, reset = true) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
      })

      if (filters.timeframe) params.append("timeframe", filters.timeframe)
      if (filters.priority) params.append("priority", filters.priority)
      if (filters.source) params.append("source", filters.source)

      const response: ContentResponse = await apiCall(`/api/content/list?${params}`)

      if (reset) {
        setContent(response.items)
      } else {
        setContent((prev) => [...prev, ...response.items])
      }

      setHasMore(response.hasMore)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContent(1, true)
  }, [filters])

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadContent(page + 1, false)
    }
  }

  const handleRefresh = () => {
    loadContent(1, true)
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "DEEP_DIVE":
        return <Zap className="h-4 w-4" />
      case "READ":
        return <BookOpen className="h-4 w-4" />
      case "SKIM":
        return <Eye className="h-4 w-4" />
      default:
        return <BookOpen className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "DEEP_DIVE":
        return "bg-red-100 text-red-800 border-red-200"
      case "READ":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "SKIM":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (loading && content.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Your Knowledge Digest</h1>
          <p className="text-gray-600">AI-analyzed content from your learning journey</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={filters.timeframe}
          onChange={(e) => setFilters((prev) => ({ ...prev, timeframe: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Time</option>
          <option value="WEEKLY">This Week</option>
          <option value="MONTHLY">This Month</option>
          <option value="QUARTERLY">This Quarter</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="DEEP_DIVE">Deep Dive</option>
          <option value="READ">Read</option>
          <option value="SKIM">Skim</option>
        </select>

        <select
          value={filters.source}
          onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sources</option>
          <option value="web">Web Articles</option>
          <option value="rss">RSS Feeds</option>
          <option value="podcast">Podcasts</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Content List */}
      <div className="space-y-6">
        {content.length === 0 && !loading ? (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
              <p className="text-gray-600 mb-4">
                Start adding URLs, RSS feeds, or other content to build your knowledge base.
              </p>
              <Button onClick={() => (window.location.href = "/sources")}>Add Content</Button>
            </CardContent>
          </Card>
        ) : (
          content.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2 line-clamp-2">{item.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {item.source}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {item.analysis && (
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1 ${getPriorityColor(item.analysis.priority)}`}
                      >
                        {getPriorityIcon(item.analysis.priority)}
                        {item.analysis.priority.replace("_", " ")}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {item.analysis && (
                <CardContent>
                  <p className="text-gray-700 mb-4 line-clamp-3">{item.analysis.summary.paragraph}</p>

                  {item.analysis.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.analysis.tags.slice(0, 5).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {item.analysis.tags.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{item.analysis.tags.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center mt-8">
          <Button onClick={handleLoadMore} disabled={loading} variant="outline">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
