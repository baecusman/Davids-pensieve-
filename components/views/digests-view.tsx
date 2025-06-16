"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar, TrendingUp, FileText, Clock } from "lucide-react"
import { ContentProcessor } from "@/lib/content-processor"

export default function DigestsView() {
  const [activeTab, setActiveTab] = useState("weekly")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedDigest, setGeneratedDigest] = useState<any>(null)

  const stats = ContentProcessor.getContentStats()

  const handleGenerateDigest = async (timeframe: "weekly" | "monthly" | "quarterly") => {
    setIsGenerating(true)
    try {
      // Mock digest generation for now
      await new Promise((resolve) => setTimeout(resolve, 2000))

      setGeneratedDigest({
        timeframe,
        summary: `Your ${timeframe} digest has been generated with ${stats.totalItems} articles analyzed.`,
        items: [],
        trendingConcepts: [
          { name: "AI Technology", reason: "Mentioned in 5 articles", importance: "High" },
          { name: "Product Strategy", reason: "Key theme this period", importance: "Medium" },
        ],
        stats: {
          totalArticles: stats.totalItems,
          deepDiveCount: stats.byPriority["deep-dive"],
          readCount: stats.byPriority.read,
          skimCount: stats.byPriority.skim,
        },
        generatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error generating digest:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Digests</h1>
        <p className="text-gray-600">AI-powered summaries of your analyzed content</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalItems}</div>
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
            <div className="text-2xl font-bold text-purple-600">{stats.byPriority["deep-dive"]}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Read Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.byPriority.read}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Skim Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.byPriority.skim}</div>
          </CardContent>
        </Card>
      </div>

      {/* Digest Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Digest</CardTitle>
              <CardDescription>Your content summary for the past week</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleGenerateDigest("weekly")}
                disabled={isGenerating || stats.totalItems === 0}
                className="w-full"
              >
                {isGenerating ? "Generating..." : "Generate Weekly Digest"}
              </Button>

              {generatedDigest && generatedDigest.timeframe === "weekly" && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Weekly Digest Generated!</h4>
                  <p className="text-sm text-green-800">{generatedDigest.summary}</p>

                  {generatedDigest.trendingConcepts.length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-green-900 mb-1">Trending Concepts:</h5>
                      <div className="space-y-1">
                        {generatedDigest.trendingConcepts.map((concept: any, index: number) => (
                          <div key={index} className="text-xs text-green-700">
                            <strong>{concept.name}</strong> - {concept.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Digest</CardTitle>
              <CardDescription>Your content summary for the past month</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleGenerateDigest("monthly")}
                disabled={isGenerating || stats.totalItems === 0}
                className="w-full"
              >
                {isGenerating ? "Generating..." : "Generate Monthly Digest"}
              </Button>

              {generatedDigest && generatedDigest.timeframe === "monthly" && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Monthly Digest Generated!</h4>
                  <p className="text-sm text-blue-800">{generatedDigest.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarterly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quarterly Digest</CardTitle>
              <CardDescription>Your content summary for the past quarter</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleGenerateDigest("quarterly")}
                disabled={isGenerating || stats.totalItems === 0}
                className="w-full"
              >
                {isGenerating ? "Generating..." : "Generate Quarterly Digest"}
              </Button>

              {generatedDigest && generatedDigest.timeframe === "quarterly" && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">Quarterly Digest Generated!</h4>
                  <p className="text-sm text-purple-800">{generatedDigest.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {stats.totalItems === 0 && (
        <Card className="mt-8">
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Content Yet</h3>
            <p className="text-gray-600 mb-4">Add some content through Source Management to generate digests</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Go to Source Management
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
