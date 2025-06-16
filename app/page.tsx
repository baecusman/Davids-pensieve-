"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Brain, FileText, ExternalLink, Rss, Settings } from "lucide-react"
import { ContentProcessor } from "@/lib/content-processor"

export default function HomePage() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("analyze")

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

  const storedContent = ContentProcessor.getStoredContent()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pensive</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Knowledge Management</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab("analyze")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "analyze"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              Analyze
            </button>
            <button
              onClick={() => setActiveTab("digests")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "digests"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FileText className="h-4 w-4" />
              Digests
            </button>
            <button
              onClick={() => setActiveTab("sources")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "sources"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Rss className="h-4 w-4" />
              Sources
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "settings"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {activeTab === "analyze" && (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Content Analysis</h2>
              <p className="text-xl text-gray-600">Analyze URLs and build your knowledge base</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{storedContent.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">0</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Deep Dives</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">0</div>
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
          </>
        )}

        {activeTab === "digests" && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Digests</h3>
            <p className="text-gray-600">Weekly, monthly, and quarterly content summaries</p>
          </div>
        )}

        {activeTab === "sources" && (
          <div className="text-center py-12">
            <Rss className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sources</h3>
            <p className="text-gray-600">Manage your RSS feeds and content sources</p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="text-center py-12">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Settings</h3>
            <p className="text-gray-600">Configure your preferences and account</p>
          </div>
        )}
      </div>
    </div>
  )
}
