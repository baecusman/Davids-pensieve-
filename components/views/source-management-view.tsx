"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Clock, ExternalLink, Rss, Twitter, Mic, Globe } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ContentProcessor } from "@/lib/content-processor"
import { databaseService } from "@/lib/database/database-service"

interface Source {
  id: string
  url: string
  title: string
  type: "rss" | "twitter" | "podcast" | "article"
  status: "active" | "processing" | "error"
  lastUpdated: string
  itemCount: number
  summary?: string
  tags?: string[]
}

export default function SourceManagementView() {
  const [url, setUrl] = useState("")
  const [sourceType, setSourceType] = useState<"one-off" | "subscription">("one-off")
  const [subscriptionType, setSubscriptionType] = useState<"rss" | "twitter" | "podcast">("rss")
  const [isProcessing, setIsProcessing] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // RSS Archive Processing
  const [rssArchiveUrl, setRssArchiveUrl] = useState("")
  const [isProcessingArchive, setIsProcessingArchive] = useState(false)
  const [archiveStatus, setArchiveStatus] = useState("")
  const [archiveResults, setArchiveResults] = useState<any>(null)

  // Load existing sources on component mount
  useEffect(() => {
    loadStoredSources()
  }, [])

  const loadStoredSources = () => {
    try {
      const storedContent = ContentProcessor.getStoredContent({ limit: 100 })
      const formattedSources: Source[] = storedContent.map((content) => ({
        id: content.id,
        url: content.url,
        title: content.title,
        type: "article",
        status: "active",
        lastUpdated: content.createdAt,
        itemCount: 1,
        summary: content.analysis.summary.sentence,
        tags: content.analysis.tags,
      }))
      setSources(formattedSources)
    } catch (error) {
      console.error("Error loading stored sources:", error)
    }
  }

  const validateUrl = (url: string): boolean => {
    try {
      // More flexible URL validation
      const urlPattern = /^https?:\/\/.+/i
      return urlPattern.test(url.trim())
    } catch {
      return false
    }
  }

  const handleAnalyze = async () => {
    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      setMessage({ type: "error", text: "Please enter a URL" })
      return
    }

    if (!validateUrl(trimmedUrl)) {
      setMessage({ type: "error", text: "Please enter a valid URL (must start with http:// or https://)" })
      return
    }

    setIsProcessing(true)
    setMessage(null)

    try {
      if (sourceType === "one-off") {
        // One-off analysis using ContentProcessor
        console.log("Starting one-off analysis for:", trimmedUrl)
        const analysis = await ContentProcessor.analyzeUrl(trimmedUrl)

        setMessage({ type: "success", text: `Successfully analyzed: ${analysis.summary?.sentence || "Content"}` })

        // Add to local sources list
        const newSource: Source = {
          id: Date.now().toString(),
          url: trimmedUrl,
          title: analysis.summary?.sentence || "Analyzed Content",
          type: "article",
          status: "active",
          lastUpdated: new Date().toISOString(),
          itemCount: 1,
          summary: analysis.summary?.sentence,
          tags: analysis.tags,
        }
        setSources((prev) => [newSource, ...prev])
      } else {
        // Subscription - simplified approach
        console.log("Starting subscription analysis for:", trimmedUrl, "type:", subscriptionType)

        // For now, treat subscriptions as one-off analysis
        // TODO: Implement proper subscription logic later
        const analysis = await ContentProcessor.analyzeUrl(trimmedUrl)

        setMessage({ type: "success", text: `Successfully added ${subscriptionType} source and analyzed content` })

        // Add to sources list
        const newSource: Source = {
          id: Date.now().toString(),
          url: trimmedUrl,
          title: analysis.summary?.sentence || `${subscriptionType} Source`,
          type: subscriptionType,
          status: "active",
          lastUpdated: new Date().toISOString(),
          itemCount: 1,
          summary: analysis.summary?.sentence,
          tags: analysis.tags,
        }
        setSources((prev) => [newSource, ...prev])
      }

      setUrl("")
    } catch (error) {
      console.error("Processing error:", error)
      const errorMessage = error instanceof Error ? error.message : "An error occurred while processing the URL"
      setMessage({
        type: "error",
        text: errorMessage,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProcessRSSArchive = async () => {
    if (!rssArchiveUrl.trim()) {
      setMessage({ type: "error", text: "Please enter an RSS URL" })
      return
    }

    if (!validateUrl(rssArchiveUrl.trim())) {
      setMessage({ type: "error", text: "Please enter a valid RSS URL" })
      return
    }

    setIsProcessingArchive(true)
    setArchiveStatus("Starting RSS archive processing...")
    setArchiveResults(null)

    try {
      const results = await databaseService.processRSSHistoricalArchive(rssArchiveUrl.trim(), 50)

      setArchiveStatus(
        `✅ Archive processing complete! Processed ${results.processed} articles with ${results.errors.length} errors.`,
      )
      setArchiveResults(results)

      // Refresh the sources list
      loadStoredSources()

      setTimeout(() => setArchiveStatus(""), 10000)
    } catch (error) {
      console.error("Error processing RSS archive:", error)
      setArchiveStatus("❌ Error processing RSS archive. Please try again.")
      setTimeout(() => setArchiveStatus(""), 5000)
    } finally {
      setIsProcessingArchive(false)
    }
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "rss":
        return <Rss className="h-4 w-4" />
      case "twitter":
        return <Twitter className="h-4 w-4" />
      case "podcast":
        return <Mic className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const rssSources = sources.filter((s) => s.type === "rss")
  const twitterSources = sources.filter((s) => s.type === "twitter")
  const podcastSources = sources.filter((s) => s.type === "podcast")

  return (
    <div className="space-y-6">
      {/* Add Content Source */}
      <Card>
        <CardHeader>
          <CardTitle>Add Content Source</CardTitle>
          <CardDescription>Add a URL for one-time analysis or subscribe to ongoing content feeds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Source URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-3">
            <Label>Source Type</Label>
            <RadioGroup
              value={sourceType}
              onValueChange={(value: "one-off" | "subscription") => setSourceType(value)}
              disabled={isProcessing}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="one-off" id="one-off" />
                <Label htmlFor="one-off">One-off Analysis</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subscription" id="subscription" />
                <Label htmlFor="subscription">Subscription</Label>
              </div>
            </RadioGroup>

            {sourceType === "subscription" && (
              <div className="ml-6 space-y-2">
                <Label>Subscription Type</Label>
                <RadioGroup
                  value={subscriptionType}
                  onValueChange={(value: "rss" | "twitter" | "podcast") => setSubscriptionType(value)}
                  disabled={isProcessing}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rss" id="rss" />
                    <Label htmlFor="rss">RSS Feed</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="twitter" id="twitter" />
                    <Label htmlFor="twitter">Twitter Profile</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="podcast" id="podcast" />
                    <Label htmlFor="podcast">Podcast Feed</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>

          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleAnalyze} disabled={isProcessing || !url.trim()} className="w-full">
            {isProcessing ? "Processing..." : sourceType === "one-off" ? "Analyze" : "Add Subscription"}
          </Button>
        </CardContent>
      </Card>

      {/* RSS Historical Archive Processing */}
      <Card>
        <CardHeader>
          <CardTitle>RSS Historical Archive Processing</CardTitle>
          <CardDescription>Process historical articles from RSS feeds in bulk</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rss-archive-url">RSS Feed URL</Label>
            <Input
              id="rss-archive-url"
              type="url"
              placeholder="https://example.com/rss.xml"
              value={rssArchiveUrl}
              onChange={(e) => setRssArchiveUrl(e.target.value)}
              disabled={isProcessingArchive}
            />
          </div>

          <Button
            onClick={handleProcessRSSArchive}
            disabled={isProcessingArchive || !rssArchiveUrl.trim()}
            className="w-full"
          >
            {isProcessingArchive ? "Processing Archive..." : "Process RSS Archive"}
          </Button>

          {archiveStatus && (
            <Alert variant={archiveStatus.includes("❌") ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{archiveStatus}</AlertDescription>
            </Alert>
          )}

          {archiveResults && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Archive Processing Results</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Processed:</span>
                  <span className="ml-2 font-medium text-green-600">{archiveResults.processed}</span>
                </div>
                <div>
                  <span className="text-gray-600">Errors:</span>
                  <span className="ml-2 font-medium text-red-600">{archiveResults.errors.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Items:</span>
                  <span className="ml-2 font-medium text-blue-600">{archiveResults.items.length}</span>
                </div>
              </div>

              {archiveResults.errors.length > 0 && (
                <div className="mt-3">
                  <details className="cursor-pointer">
                    <summary className="text-sm font-medium text-gray-700">View Errors</summary>
                    <div className="mt-2 space-y-1">
                      {archiveResults.errors.slice(0, 5).map((error: string, index: number) => (
                        <p key={index} className="text-xs text-red-600">
                          {error}
                        </p>
                      ))}
                      {archiveResults.errors.length > 5 && (
                        <p className="text-xs text-gray-500">... and {archiveResults.errors.length - 5} more</p>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500">
            <p>• Processes up to 50 historical articles from the RSS feed</p>
            <p>• Automatically analyzes and adds to your knowledge base</p>
            <p>• Skips articles already in your database</p>
          </div>
        </CardContent>
      </Card>

      {/* Sources Tabs */}
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sources">Sources ({sources.length})</TabsTrigger>
          <TabsTrigger value="rss">RSS ({rssSources.length})</TabsTrigger>
          <TabsTrigger value="twitter">Twitter ({twitterSources.length})</TabsTrigger>
          <TabsTrigger value="podcasts">Podcasts ({podcastSources.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyzed Sources ({sources.length})</CardTitle>
              {sources.length > 0 && (
                <Button variant="outline" size="sm" onClick={loadStoredSources} className="w-fit">
                  Refresh
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No sources analyzed yet</p>
                  <p className="text-sm">Add a URL above to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-3 flex-1">
                        {getSourceIcon(source.type)}
                        <div className="flex-1">
                          <p className="font-medium">{source.title}</p>
                          <p className="text-sm text-gray-500 mb-2">{source.url}</p>
                          {source.summary && <p className="text-sm text-gray-700 mb-2">{source.summary}</p>}
                          {source.tags && source.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {source.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {source.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{source.tags.length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{source.type}</Badge>
                        {getStatusIcon(source.status)}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rss">
          <Card>
            <CardHeader>
              <CardTitle>RSS Feeds ({rssSources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {rssSources.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Rss className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No RSS feeds added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rssSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Rss className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{source.title}</p>
                          <p className="text-sm text-gray-500">{source.itemCount} items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(source.status)}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="twitter">
          <Card>
            <CardHeader>
              <CardTitle>Twitter Sources ({twitterSources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {twitterSources.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Twitter className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No Twitter sources added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {twitterSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Twitter className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{source.title}</p>
                          <p className="text-sm text-gray-500">{source.itemCount} items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(source.status)}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="podcasts">
          <Card>
            <CardHeader>
              <CardTitle>Podcasts ({podcastSources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {podcastSources.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Mic className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No podcasts added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {podcastSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mic className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{source.title}</p>
                          <p className="text-sm text-gray-500">{source.itemCount} items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(source.status)}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
