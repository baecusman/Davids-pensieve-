"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, Edit2, Save, X } from 'lucide-react'
import { supabaseSourceService } from "@/lib/services/supabase-source-service"

interface Source {
  id: string
  url: string
  title: string
  description: string
  isActive: boolean
  lastFetched?: string
  itemCount: number
  errorCount: number
}

export function SourceManagementView() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSource, setNewSource] = useState({
    url: "",
    title: "",
    description: "",
  })

  useEffect(() => {
    loadSources()
  }, [])

  const loadSources = async () => {
    try {
      setLoading(true)
      const userSources = await supabaseSourceService.getUserSources()
      setSources(userSources)
    } catch (error) {
      console.error("Error loading sources:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSource = async () => {
    if (!newSource.url.trim() || !newSource.title.trim()) return

    try {
      await supabaseSourceService.addSource(newSource)
      setNewSource({ url: "", title: "", description: "" })
      setShowAddForm(false)
      await loadSources()
    } catch (error) {
      console.error("Error adding source:", error)
    }
  }

  const handleUpdateSource = async (id: string, updates: Partial<Source>) => {
    try {
      await supabaseSourceService.updateSource(id, updates)
      await loadSources()
      setEditingId(null)
    } catch (error) {
      console.error("Error updating source:", error)
    }
  }

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Are you sure you want to delete this source?")) return

    try {
      await supabaseSourceService.deleteSource(id)
      await loadSources()
    } catch (error) {
      console.error("Error deleting source:", error)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await handleUpdateSource(id, { isActive })
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Content Sources</h2>
          <p className="text-gray-600">Manage your RSS feeds and content sources</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Source
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Source</CardTitle>
            <CardDescription>Add a new RSS feed or content source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="url">RSS Feed URL</Label>
              <Input
                id="url"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                placeholder="https://example.com/feed.xml"
              />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newSource.title}
                onChange={(e) => setNewSource({ ...newSource, title: e.target.value })}
                placeholder="Source name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newSource.description}
                onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddSource}>Add Source</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {editingId === source.id ? (
                    <EditSourceForm
                      source={source}
                      onSave={(updates) => handleUpdateSource(source.id, updates)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{source.title}</h3>
                        <Badge variant={source.isActive ? "default" : "secondary"}>
                          {source.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{source.description}</p>
                      <p className="text-xs text-gray-500 font-mono">{source.url}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{source.itemCount} items</span>
                        {source.errorCount > 0 && (
                          <span className="text-red-500">{source.errorCount} errors</span>
                        )}
                        {source.lastFetched && (
                          <span>Last fetched: {new Date(source.lastFetched).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Switch
                    checked={source.isActive}
                    onCheckedChange={(checked) => handleToggleActive(source.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(source.id)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSource(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sources.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">No sources configured yet.</p>
            <Button onClick={() => setShowAddForm(true)} className="mt-4">
              Add your first source
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EditSourceForm({
  source,
  onSave,
  onCancel,
}: {
  source: Source
  onSave: (updates: Partial<Source>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(source.title)
  const [description, setDescription] = useState(source.description)

  const handleSave = () => {
    onSave({ title, description })
  }

  return (
    <div className="space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Source title"
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Source description"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  )
}
