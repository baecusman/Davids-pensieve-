"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, FileText, Sparkles } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { digestService } from "@/lib/services/digest-service"

interface Digest {
  id: string
  type: string
  title: string
  content: string
  content_ids: string[]
  status: string
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

export function DigestsView() {
  const { user } = useAuth()
  const [digests, setDigests] = useState<Digest[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedDigest, setSelectedDigest] = useState<Digest | null>(null)

  useEffect(() => {
    if (user) {
      loadDigests()
    }
  }, [user])

  const loadDigests = async () => {
    if (!user) return

    try {
      setLoading(true)
      const userDigests = await digestService.getUserDigests(user.id)
      setDigests(userDigests)
    } catch (error) {
      console.error("Error loading digests:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDigest = async (type: "weekly" | "monthly" | "quarterly") => {
    if (!user) return

    try {
      setGenerating(true)
      await digestService.generateDigest(user.id, type)
      await loadDigests()
    } catch (error) {
      console.error("Error generating digest:", error)
      alert("Failed to generate digest. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "sent":
        return "default"
      case "scheduled":
        return "secondary"
      case "draft":
        return "outline"
      default:
        return "outline"
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Knowledge Digests</h2>
        <p className="text-gray-600">AI-powered summaries of your most important content.</p>
      </div>

      {/* Generate New Digest */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate New Digest
          </CardTitle>
          <CardDescription>Create an AI-powered summary of your recent content.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handleGenerateDigest("weekly")}
              disabled={generating}
              className="h-20 flex-col gap-2"
            >
              <Calendar className="h-5 w-5" />
              <span>Weekly Digest</span>
              <span className="text-xs opacity-70">Last 7 days</span>
            </Button>
            <Button
              onClick={() => handleGenerateDigest("monthly")}
              disabled={generating}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              <Calendar className="h-5 w-5" />
              <span>Monthly Digest</span>
              <span className="text-xs opacity-70">Last 30 days</span>
            </Button>
            <Button
              onClick={() => handleGenerateDigest("quarterly")}
              disabled={generating}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              <Calendar className="h-5 w-5" />
              <span>Quarterly Digest</span>
              <span className="text-xs opacity-70">Last 90 days</span>
            </Button>
          </div>
          {generating && <p className="text-sm text-gray-600">Generating digest... This may take a moment.</p>}
        </CardContent>
      </Card>

      {/* Existing Digests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Digest List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Digests ({digests.length})</h3>

          {digests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No digests generated yet.</p>
                <p className="text-sm text-gray-400">Generate your first digest to get AI-powered insights.</p>
              </CardContent>
            </Card>
          ) : (
            digests.map((digest) => (
              <Card
                key={digest.id}
                className={`cursor-pointer transition-colors ${
                  selectedDigest?.id === digest.id ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedDigest(digest)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{digest.title}</h4>
                    <Badge variant={getStatusColor(digest.status)}>{digest.status}</Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {digest.type}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {digest.content_ids.length} articles
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">
                    Created: {new Date(digest.created_at).toLocaleDateString()}
                    {digest.sent_at && (
                      <span className="ml-4">Sent: {new Date(digest.sent_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Digest Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Preview</h3>

          {selectedDigest ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {selectedDigest.title}
                  <Badge variant={getStatusColor(selectedDigest.status)}>{selectedDigest.status}</Badge>
                </CardTitle>
                <CardDescription>
                  {selectedDigest.type} digest • {selectedDigest.content_ids.length} articles •{" "}
                  {new Date(selectedDigest.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedDigest.content }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select a digest to preview its content.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
