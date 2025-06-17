"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Trash2, ExternalLink, Rss, Plus, Twitter, Headphones, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { mockDb, type Source } from "@/lib/database/mock-db"
import { useAuth } from "@/components/auth/auth-provider"

export default function SourceManagementView() {
  const { user } = useAuth()
  const [sources, setSources] = useState<Source[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState("")

  useEffect(() => {
    loadSources()
  }, [user])

  const loadSources = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const userSources = await mockDb.source.findByUserId(user.id)
      setSources(userSources)
    } catch (error) {
      console.error("Error loading sources:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const url = formData.get("url") as string
    const type = formData.get("type") as "RSS" | "PODCAST" | "TWITTER" | "MANUAL"

    setIsProcessing(true)
    setProcessingStatus("Adding source...")

    try {
      await mockDb.source.create({
        userId: user.id,
        name,
        url,
        type,
      })

      setIsAddDialogOpen(false)
      setProcessingStatus("✅ Source added successfully!")
      loadSources()

      // Reset form
      ;(e.target as HTMLFormElement).reset()
    } catch (error) {
      console.error("Error adding source:", error)
      setProcessingStatus("❌ Failed to add source")
    } finally {
      setIsProcessing(false)
      setTimeout(() => setProcessingStatus(""), 3000)
    }
  }

  const handleToggleSource = async (sourceId: string, isActive: boolean) => {
    try {
      await mockDb.source.update(sourceId, { isActive })
      loadSources()
      setProcessingStatus(`✅ Source ${isActive ? "activated" : "deactivated"}`)
      setTimeout(() => setProcessingStatus(""), 3000)
    } catch (error) {
      console.error("Error updating source:", error)
      setProcessingStatus("❌ Failed to update source")
      setTimeout(() => setProcessingStatus(""), 3000)
    }
  }

  const handleDeleteSource = async (sourceId: string, sourceName: string) => {
    if (!confirm(`Are you sure you want to delete "${sourceName}"?`)) return

    try {
      await mockDb.source.delete(sourceId)
      loadSources()
      setProcessingStatus(`✅ Deleted "${sourceName}"`)
      setTimeout(() => setProcessingStatus(""), 3000)
    } catch (error) {
      console.error("Error deleting source:", error)
      setProcessingStatus("❌ Failed to delete source")
      setTimeout(() => setProcessingStatus(""), 3000)
    }
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "RSS":
        return <Rss className="h-4 w-4 text-orange-500" />
      case "TWITTER":
        return <Twitter className="h-4 w-4 text-blue-500" />
      case "PODCAST":
        return <Headphones className="h-4 w-4 text-purple-500" />
      default:
        return <ExternalLink className="h-4 w-4 text-gray-500" />
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
          <h1 className="text-3xl font-bold text-gray-900">Content Sources</h1>
          <p className="text-gray-600">Manage your RSS feeds, podcasts, and other content sources</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Source</DialogTitle>
              <DialogDescription>
                Add a new RSS feed, podcast, or other content source to your collection.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSource} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="e.g., TechCrunch" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input id="url" name="url" type="url" placeholder="https://example.com/feed.xml" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select name="type" defaultValue="RSS">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSS">RSS Feed</SelectItem>
                    <SelectItem value="PODCAST">Podcast</SelectItem>
                    <SelectItem value="TWITTER">Twitter</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Source"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Message */}
      {processingStatus && (
        <div
          className={`p-3 rounded-lg border ${
            processingStatus.includes("❌")
              ? "bg-red-50 border-red-200 text-red-800"
              : processingStatus.includes("✅")
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          {processingStatus}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getSourceIcon(source.type)}
                  <CardTitle className="text-lg">{source.name}</CardTitle>
                </div>
                <Badge variant={source.type === "RSS" ? "default" : "secondary"}>{source.type}</Badge>
              </div>
              <CardDescription className="flex items-center space-x-2">
                <ExternalLink className="h-3 w-3" />
                <span className="truncate">{source.url}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={source.isActive}
                    onCheckedChange={(checked) => handleToggleSource(source.id, checked)}
                  />
                  <span className="text-sm text-gray-600">{source.isActive ? "Active" : "Inactive"}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSource(source.id, source.name)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {source.lastFetched && (
                <p className="text-xs text-gray-500 mt-2">Last fetched: {source.lastFetched.toLocaleDateString()}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {sources.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Rss className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sources yet</h3>
            <p className="text-gray-600 text-center mb-4">
              Add your first content source to start building your knowledge base.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
