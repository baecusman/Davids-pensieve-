"use client"

import { useState, useEffect } from "react"
import { databaseService } from "@/lib/database/database-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Network, TrendingUp } from "lucide-react"
import { mockPrisma, type Concept } from "@/lib/database/mock-db"
import { useAuth } from "@/components/auth/auth-provider"

export default function ConceptMapView() {
  const { user } = useAuth()
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [abstractionLevel, setAbstractionLevel] = useState(30)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [conceptStats, setConceptStats] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    types: [] as string[],
    minFrequency: 1,
    source: "all" as "all" | "analyzed" | "historical",
  })

  useEffect(() => {
    loadConceptStats()
    loadConcepts()
  }, [user])

  const loadConcepts = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const userConcepts = await mockPrisma.concept.findMany({
        where: { userId: user.id },
      })
      setConcepts(userConcepts.sort((a, b) => b.frequency - a.frequency))
    } catch (error) {
      console.error("Error loading concepts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadConceptStats = async () => {
    try {
      setIsLoading(true)
      const stats = databaseService.getDatabaseStats()
      setConceptStats(stats.concepts)
    } catch (error) {
      console.error("Error loading concept stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConceptClick = (conceptId: string) => {
    setSelectedNodeId(conceptId)
    setShowSearchResults(false)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      try {
        const results = databaseService.searchConcepts(query)
        setSearchResults(results)
        setShowSearchResults(true)
      } catch (error) {
        console.error("Error searching concepts:", error)
        setSearchResults([])
        setShowSearchResults(false)
      }
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setShowSearchResults(false)
  }

  const handleSearchResultClick = (conceptId: string) => {
    setSelectedNodeId(conceptId)
    setShowSearchResults(false)
  }

  const handleExportGraph = () => {
    try {
      const data = databaseService.getConceptMapData(abstractionLevel, searchQuery)
      const exportData = {
        nodes: data.nodes,
        edges: data.edges,
        metadata: {
          abstractionLevel,
          searchQuery,
          exportedAt: new Date().toISOString(),
          totalNodes: data.nodes.length,
          totalEdges: data.edges.length,
        },
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `concept-map-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting graph:", error)
    }
  }

  const handleRefresh = () => {
    loadConceptStats()
    // Force re-render of concept map
    setSelectedNodeId(null)
  }

  const applyFilters = (newFilters: typeof filters) => {
    setFilters(newFilters)
    // The concept map will automatically update based on the new filters
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Concept Map</h1>
        <p className="text-gray-600">Explore the key concepts and relationships in your knowledge base</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {concepts.map((concept) => (
          <Card key={concept.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{concept.name}</CardTitle>
                <Badge variant="secondary">{concept.type}</Badge>
              </div>
              {concept.description && <CardDescription>{concept.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">{concept.frequency} mentions</span>
                </div>
                <div className="text-xs text-gray-500">{concept.createdAt.toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {concepts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Network className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No concepts discovered yet</h3>
            <p className="text-gray-600 text-center mb-4">
              Add content sources and analyze some articles to see your concept map grow.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
