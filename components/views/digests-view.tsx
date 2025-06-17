"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Mail, TrendingUp, Sparkles } from "lucide-react"
import { mockDb, type Digest } from "@/lib/database/mock-db"
import { useAuth } from "@/components/auth/auth-provider"

export function DigestsView() {
  const { user } = useAuth()
  const [digests, setDigests] = useState<Digest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    loadDigests()
  }, [user])

  const loadDigests = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const userDigests = await mockDb.digest.findByUserId(user.id)
      setDigests(userDigests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
    } catch (error) {
      console.error("Error loading digests:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateDigest = async () => {
    if (!user) return

    setIsGenerating(true)

    // Simulate digest generation
    setTimeout(async () => {
      try {
        const newDigest: Omit<Digest, "id" | "createdAt"> = {
          userId: user.id,
          type: "WEEKLY",
          title: `Weekly Knowledge Digest - ${new Date().toLocaleDateString()}`,
          content:
            "This week's digest includes insights from your latest content sources. Key themes include artificial intelligence developments, software engineering best practices, and emerging technology trends. The analysis shows growing interest in AI-powered development tools and distributed computing architectures.",
          contentIds: [],
          status: "DRAFT",
        }

        // Add to mock database
        const digestData: Digest = {
          id: Math.random().toString(36).substr(2, 9),
          createdAt: new Date(),
          ...newDigest,
        }

        // Simulate adding to storage
        setDigests((prev) => [digestData, ...prev])
      } catch (error) {
        console.error("Error generating digest:", error)
      } finally {
        setIsGenerating(false)
      }
    }, 2000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SENT":
        return "default"
      case "DRAFT":
        return "secondary"
      case "SCHEDULED":
        return "outline"
      default:
        return "secondary"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Digests</h1>
          <p className="text-gray-600">AI-generated summaries of your curated content</p>
        </div>
        <Button onClick={handleGenerateDigest} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Sparkles className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Generate New Digest
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6">
        {digests.map((digest) => (
          <Card key={digest.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{digest.title}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusColor(digest.status)}>{digest.status}</Badge>
                  <Badge variant="outline">{digest.type}</Badge>
                </div>
              </div>
              <CardDescription className="flex items-center space-x-4 text-sm">
                <span className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {digest.createdAt.toLocaleDateString()}
                </span>
                {digest.sentAt && (
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Sent {digest.sentAt.toLocaleDateString()}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 leading-relaxed">{digest.content}</p>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {digest.contentIds.length || 3} articles analyzed
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    Read Full Digest
                  </Button>
                  {digest.status === "DRAFT" && (
                    <Button size="sm">
                      <Mail className="h-3 w-3 mr-1" />
                      Send
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {digests.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No digests yet</h3>
            <p className="text-gray-600 text-center mb-4">
              Add some content sources and we'll generate your first digest automatically.
            </p>
            <Button onClick={handleGenerateDigest} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Generate Your First Digest
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
