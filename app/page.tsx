"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Brain, FileText, ExternalLink } from "lucide-react"
import { ContentProcessor } from "@/lib/content-processor"

export default function HomePage() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError("Please enter a URL")
      return
    }

    setIsAnalyzing(true)
    setError("")
    setResult(null)

    try {
      const analysis = await ContentProcessor.analyzeUrl(url.trim())
      setResult(analysis)
      setUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const stats = ContentProcessor.getContentStats()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Pensive</h1>
          </div>
          <p className="text-xl text-gray-600">AI-powered knowledge management and content analysis</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.totalItems}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.byTimeframe["last-week"]}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Deep Dives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.byPriority["deep-dive"]}</div>
            </CardContent>
          </Card>
        </div>

        {/* URL Analysis */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Analyze Content
            </CardTitle>
            <CardDescription>Enter a URL to analyze and add to your knowledge base</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isAnalyzing}
                className="flex-1"
              />
              <Button onClick={handleAnalyze} disabled={isAnalyzing || !url.trim()}>
                {isAnalyzing ? "Analyzing..." : "Analyze"}
              </Button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}

            {result && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Analysis Complete!</h4>
                <p className="text-sm text-green-800 mb-3">{result.summary.sentence}</p>
                <div className="flex flex-wrap gap-1">
                  {result.tags.map((tag: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      result.priority === "deep-dive"
                        ? "bg-purple-100 text-purple-700"
                        : result.priority === "read"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {result.priority}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generate Digest
              </CardTitle>
              <CardDescription>Create AI-powered summaries of your content</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled={stats.totalItems === 0}>
                Create Weekly Digest
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Concept Map
              </CardTitle>
              <CardDescription>Explore connections between your ideas</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled={stats.totalItems === 0}>
                View Concept Map
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Content */}
        {stats.totalItems > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Recent Content</CardTitle>
              <CardDescription>Your latest analyzed content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ContentProcessor.getStoredContent({ limit: 5 }).map((item, index) => (
                  <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{item.analysis.summary.sentence}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            item.analysis.priority === "deep-dive"
                              ? "bg-purple-100 text-purple-700"
                              : item.analysis.priority === "read"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.analysis.priority}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
