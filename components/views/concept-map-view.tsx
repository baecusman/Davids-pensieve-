"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Network, Zap, Eye, RotateCcw, Download } from "lucide-react"
import ConceptDetailsSidebar from "@/components/concept-details-sidebar"
import { ContentProcessor } from "@/lib/content-processor"

interface ConceptNode {
  id: string
  name: string
  type: "concept" | "person" | "organization" | "technology" | "methodology"
  frequency: number
  connections: number
  x?: number
  y?: number
  size?: number
  color?: string
}

interface ConceptLink {
  source: string
  target: string
  type: "INCLUDES" | "RELATES_TO" | "IMPLEMENTS" | "USES" | "COMPETES_WITH"
  strength: number
}

export default function ConceptMapView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [abstractionLevel, setAbstractionLevel] = useState([30])
  const [selectedConcept, setSelectedConcept] = useState<ConceptNode | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [concepts, setConcepts] = useState<ConceptNode[]>([])
  const [links, setLinks] = useState<ConceptLink[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load concepts from stored content
  useEffect(() => {
    loadConceptsFromContent()
  }, [])

  const loadConceptsFromContent = () => {
    try {
      const storedContent = ContentProcessor.getStoredContent()
      const conceptMap = new Map<string, ConceptNode>()
      const linkMap = new Map<string, ConceptLink>()

      // Extract concepts from all content
      storedContent.forEach((content) => {
        if (content.analysis?.entities) {
          content.analysis.entities.forEach((entity) => {
            const key = `${entity.name}-${entity.type}`
            if (conceptMap.has(key)) {
              const existing = conceptMap.get(key)!
              existing.frequency += 1
            } else {
              conceptMap.set(key, {
                id: key,
                name: entity.name,
                type: entity.type,
                frequency: 1,
                connections: 0,
                size: Math.random() * 20 + 10,
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100,
                color: getTypeColor(entity.type),
              })
            }
          })
        }

        // Extract relationships
        if (content.analysis?.relationships) {
          content.analysis.relationships.forEach((rel) => {
            const linkKey = `${rel.from}-${rel.to}-${rel.type}`
            if (!linkMap.has(linkKey)) {
              linkMap.set(linkKey, {
                source: `${rel.from}-concept`,
                target: `${rel.to}-concept`,
                type: rel.type,
                strength: 1,
              })
            } else {
              const existing = linkMap.get(linkKey)!
              existing.strength += 1
            }
          })
        }
      })

      // Update connection counts
      linkMap.forEach((link) => {
        const sourceConcept = Array.from(conceptMap.values()).find((c) => c.id === link.source)
        const targetConcept = Array.from(conceptMap.values()).find((c) => c.id === link.target)
        if (sourceConcept) sourceConcept.connections += 1
        if (targetConcept) targetConcept.connections += 1
      })

      setConcepts(Array.from(conceptMap.values()))
      setLinks(Array.from(linkMap.values()))
      setIsLoading(false)
    } catch (error) {
      console.error("Error loading concepts:", error)
      setIsLoading(false)
    }
  }

  const getTypeColor = (type: string): string => {
    const colors = {
      concept: "#3b82f6", // blue
      person: "#10b981", // green
      organization: "#f59e0b", // amber
      technology: "#8b5cf6", // purple
      methodology: "#ef4444", // red
    }
    return colors[type as keyof typeof colors] || "#6b7280"
  }

  const filteredConcepts = concepts.filter((concept) => {
    const matchesSearch = concept.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(concept.type)
    const matchesAbstraction = concept.frequency >= (100 - abstractionLevel[0]) / 10
    return matchesSearch && matchesType && matchesAbstraction
  })

  const handleConceptClick = (concept: ConceptNode) => {
    setSelectedConcept(concept)
  }

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const resetView = () => {
    setSearchQuery("")
    setAbstractionLevel([30])
    setSelectedTypes([])
    setSelectedConcept(null)
  }

  const exportMap = () => {
    const data = { concepts: filteredConcepts, links }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `concept-map-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Network className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading concept map...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Controls */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Concept Map</h2>
          </div>

          {/* Search */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="search">Search Concepts</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search concepts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Abstraction Level */}
            <div>
              <Label>Abstraction Level: {abstractionLevel[0]}%</Label>
              <div className="mt-2">
                <Slider
                  value={abstractionLevel}
                  onValueChange={setAbstractionLevel}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Show All</span>
                  <span>Core Only</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Filters</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4" />
                </Button>
              </div>

              {showFilters && (
                <div className="mt-2 space-y-2">
                  {["concept", "person", "organization", "technology", "methodology"].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={type}
                        checked={selectedTypes.includes(type)}
                        onChange={() => handleTypeToggle(type)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={type} className="text-sm capitalize">
                        {type}
                      </label>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTypeColor(type) }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetView}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={exportMap}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Concept List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
              <span>Concepts ({filteredConcepts.length})</span>
              <Button variant="ghost" size="sm" onClick={loadConceptsFromContent}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {filteredConcepts.map((concept) => (
              <div
                key={concept.id}
                onClick={() => handleConceptClick(concept)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedConcept?.id === concept.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: concept.color }} />
                    <span className="font-medium text-sm">{concept.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {concept.frequency}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span className="capitalize">{concept.type}</span>
                  <span>{concept.connections} connections</span>
                </div>
              </div>
            ))}

            {filteredConcepts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Network className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No concepts found</p>
                <p className="text-xs">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 bg-white">
          {/* Graph Visualization Placeholder */}
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center">
              <Network className="h-24 w-24 text-blue-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Interactive Concept Map</h3>
              <p className="text-gray-600 mb-4">
                Visualizing {filteredConcepts.length} concepts with {links.length} relationships
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                {filteredConcepts.slice(0, 8).map((concept) => (
                  <div
                    key={concept.id}
                    onClick={() => handleConceptClick(concept)}
                    className="p-3 bg-white rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: concept.color }} />
                      <span className="text-sm font-medium truncate">{concept.name}</span>
                    </div>
                    <div className="text-xs text-gray-500">{concept.frequency} mentions</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Graph Controls */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Button variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-1" />
              Auto Layout
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              Focus Mode
            </Button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg border">
            <h4 className="font-medium text-sm mb-2">Legend</h4>
            <div className="space-y-1">
              {["concept", "person", "organization", "technology", "methodology"].map((type) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTypeColor(type) }} />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Concept Details */}
      {selectedConcept && (
        <ConceptDetailsSidebar
          concept={selectedConcept}
          onClose={() => setSelectedConcept(null)}
          relatedConcepts={concepts.filter((c) => c.id !== selectedConcept.id).slice(0, 5)}
        />
      )}
    </div>
  )
}
