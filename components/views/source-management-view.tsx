"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, RefreshCw, ExternalLink } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { feedService } from "@/lib/services/feed-service"
import { contentService } from "@/lib/services/content-service"

interface Feed {
  id: string
  name: string
  url: string
  type: string
  is_active: boolean
  last_fetched: string | null
  created_at: string
}

export function SourceManagementView() {
  const { user } = useAuth()
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [newFeedUrl, setNewFeedUrl] = useState("")
  const [newFeedName, setNewFeedName] = useState("")
  const [addingFeed, setAddingFeed] = useState(false)

  useEffect(() => {
    if (user) {
      loadFeeds()
    }
  }, [user])

  const loadFeeds = async () => {
    if (!user) return

    try {
      setLoading(true)
      const userFeeds = await feedService.getUserFeeds(user.id)
      setFeeds(userFeeds)
    } catch (error) {
      console.error("Error loading feeds:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFeed = async () => {
    if (!user || !newFeedUrl.trim() || !newFeedName.trim()) return

    try {
      setAddingFeed(true)
      await feedService.addFeed(user.id, {
        url: newFeedUrl.trim(),
        name: newFeedName.trim(),
        type: "RSS",
      })

      // Add some sample content for the new feed
      await contentService.storeContent(user.id, {
        title: `Sample article from ${newFeedName}`,
        url: newFeedUrl,
        content: `This is sample content from ${newFeedName}. In a real implementation, this would be fetched from the RSS feed and processed automatically.`,
        source: newFeedName,
      })

      setNewFeedUrl("")
      setNewFeedName("")
      await loadFeeds()
    } catch (error) {
      console.error("Error adding feed:", error)
      alert("Failed to add feed. Please try again.")
    } finally {
      setAddingFeed(false)
    }
  }

  const handleToggleFeed = async (feedId: string, isActive: boolean) => {
    if (!user) return

    try {
      await feedService.updateFeed(user.id, feedId, { isActive })
      await loadFeeds()
    } catch (error) {
      console.error("Error toggling feed:", error)
    }
  }

  const handleDeleteFeed = async (feedId: string) => {
    if (!user || !confirm("Are you sure you want to delete this feed?")) return

    try {
      await feedService.deleteFeed(user.id, feedId)
      await loadFeeds()
    } catch (error) {
      console.error("Error deleting feed:", error)
    }
  }

  const handleFetchFeed = async (feedId: string) => {
    if (!user) return

    try {
      await feedService.fetchFeed(user.id, feedId)
      await loadFeeds()
    } catch (error) {
      console.error("Error fetching feed:", error)
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
        <h2 className="text-2xl font-bold mb-2">Content Sources</h2>
        <p className="text-gray-600">Manage your RSS feeds, podcasts, and other content sources.</p>
      </div>

      {/* Add New Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Source
          </CardTitle>
          <CardDescription>Add RSS feeds, podcasts, or other content sources to your library.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Source Name</label>
              <Input
                placeholder="e.g., TechCrunch, The Verge"
                value={newFeedName}
                onChange={(e) => setNewFeedName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <Input
                placeholder="https://example.com/feed.xml"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAddFeed} disabled={addingFeed || !newFeedUrl.trim() || !newFeedName.trim()}>
            {addingFeed ? "Adding..." : "Add Source"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Feeds */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Sources ({feeds.length})</h3>

        {feeds.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500 mb-4">No content sources added yet.</p>
              <p className="text-sm text-gray-400">Add your first RSS feed or content source above to get started.</p>
            </CardContent>
          </Card>
        ) : (
          feeds.map((feed) => (
            <Card key={feed.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{feed.name}</h4>
                      <Badge variant={feed.is_active ? "default" : "secondary"}>
                        {feed.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{feed.type}</Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <ExternalLink className="h-4 w-4" />
                      <a href={feed.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {feed.url}
                      </a>
                    </div>

                    <div className="text-sm text-gray-500">
                      Added: {new Date(feed.created_at).toLocaleDateString()}
                      {feed.last_fetched && (
                        <span className="ml-4">Last fetched: {new Date(feed.last_fetched).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={feed.is_active}
                      onCheckedChange={(checked) => handleToggleFeed(feed.id, checked)}
                    />
                    <Button variant="outline" size="sm" onClick={() => handleFetchFeed(feed.id)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteFeed(feed.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Add Popular Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Sources</CardTitle>
          <CardDescription>Quick add popular tech and business publications.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
              { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
              { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
              { name: "Wired", url: "https://www.wired.com/feed/rss" },
              { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/" },
              { name: "Hacker News", url: "https://hnrss.org/frontpage" },
            ].map((source) => (
              <Button
                key={source.name}
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewFeedName(source.name)
                  setNewFeedUrl(source.url)
                }}
                className="justify-start"
              >
                {source.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
