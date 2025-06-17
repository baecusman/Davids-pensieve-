"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Search, Brain, Network, Filter } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { contentService } from "@/lib/services/content-service"

interface ConceptNode {
  id: string
  label: string
  type: string
  frequency: number
  density: number
  description: string
}

interface ConceptEdge {
  id: string
  source: string
  target: string
  type: string
  weight: number
}

interface ConceptMapData {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
}

export function ConceptMapView() {
  const { user } = useAuth()
  const [conceptMap, setConceptMap] = useState<ConceptMapData>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [abstractionLevel, setAbstractionLevel] = useState([50])
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null)

  useEffect(() => {
    if (user) {
      loadConceptMap()
    }
  }, [user, abstractionLevel, searchQuery])

  const loadConceptMap = async () => {
    if (!user) return

    try {
      setLoading(true)
      const mapData = await contentService.getConceptMap(user.id, abstractionLevel[0], searchQuery)
      setConceptMap(mapData)
    } catch (error) {
      console.error("Error loading concept map:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      concept: "bg-blue-100 text-blue-800",
      technology: "bg-green-100 text-green-800",
      person: "bg-purple-100 text-purple-800",
      organization: "bg-orange-100 text-orange-800",
      location: "bg-red-100 text-red-800",
    }
    return colors[type] || "bg-gray-100 text-gray-800"
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Concept Map</h2>
        <p className="text-gray-600">Explore the relationships between concepts in your knowledge base.</p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Map Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Search Concepts</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search for concepts..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Abstraction Level: {abstractionLevel[0]}%</label>
              <Slider
                value={abstractionLevel}
                onValueChange={setAbstractionLevel}
                max={100}
                min={0}
                step={10}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Higher values show only the most frequent concepts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Concept Map Visualization */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Concept Network ({conceptMap.nodes.length} concepts, {conceptMap.edges.length} connections)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conceptMap.nodes.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No concepts found.</p>
                  <p className="text-sm text-gray-400">
                    {searchQuery
                      ? "Try adjusting your search or abstraction level."
                      : "Add some content to see concepts appear."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Simple grid layout for concepts */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {conceptMap.nodes.map((node) => (
                      <div
                        key={node.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                          selectedNode?.id === node.id ? "ring-2 ring-blue-500" : ""
                        }`}
                        onClick={() => setSelectedNode(node)}
                      >
                        <div className="text-sm font-medium mb-1">{node.label}</div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={getNodeColor(node.type)}>
                            {node.type}
                          </Badge>
                          <span className="text-xs text-gray-500">{node.frequency}x</span>
                        </div>
                        <div className="mt-2 bg-gray-200 rounded-full h-1">
                          <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${node.density}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Connections Summary */}
                  {conceptMap.edges.length > 0 && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-2">Concept Relationships</h4>
                      <div className="text-sm text-gray-600">
                        <p>{conceptMap.edges.length} connections found between concepts</p>
                        <p className="mt-1">
                          Most connected:{" "}
                          {conceptMap.nodes.sort((a, b) => {
                            const aConnections = conceptMap.edges.filter(
                              (e) => e.source === a.id || e.target === a.id,
                            ).length
                            const bConnections = conceptMap.edges.filter(
                              (e) => e.source === b.id || e.target === b.id,
                            ).length
                            return bConnections - aConnections
                          })[0]?.label || "None"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Concept Details */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Concept Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-lg">{selectedNode.label}</h4>
                    <Badge variant="outline" className={getNodeColor(selectedNode.type)}>
                      {selectedNode.type}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Frequency:</span>
                      <span className="font-medium">{selectedNode.frequency} mentions</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Density:</span>
                      <span className="font-medium">{Math.round(selectedNode.density)}%</span>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">Description</h5>
                    <p className="text-sm text-gray-600">{selectedNode.description}</p>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">Connections</h5>
                    <div className="space-y-1">
                      {conceptMap.edges
                        .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
                        .slice(0, 5)
                        .map((edge) => {
                          const connectedNodeId = edge.source === selectedNode.id ? edge.target : edge.source
                          const connectedNode = conceptMap.nodes.find((n) => n.id === connectedNodeId)
                          return connectedNode ? (
                            <div key={edge.id} className="text-sm p-2 bg-gray-50 rounded">
                              <span className="font-medium">{connectedNode.label}</span>
                              <span className="text-gray-500 ml-2">({edge.type})</span>
                            </div>
                          ) : null
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Select a concept to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
