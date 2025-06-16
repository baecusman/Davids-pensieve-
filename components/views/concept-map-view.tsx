"use client"

import { useState, useEffect } from "react"
import { Search, X, Filter, Download, RefreshCw } from "lucide-react"
import ConceptMap from "../concept-map"
import ConceptDetailsSidebar from "../concept-details-sidebar"
import LoadingSkeleton from "../loading-skeleton"
import { databaseService } from "@/lib/database/database-service"

export default function ConceptMapView() {
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
  }, [])

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
      <div className="max-w-full mx-auto px-4 py-8 h-[calc(100vh-200px)]">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto px-4 py-8 h-[calc(100vh-200px)]">
      <div className="flex h-full relative">
        {/* Sidebar for controls */}
        <div className="w-64 bg-gray-50 rounded-lg p-4 mr-4 flex-shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Graph Controls</h3>
            <div className="flex gap-1">
              <button
                onClick={handleRefresh}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={handleExportGraph}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Export graph"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Concepts</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for concepts..."
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-56 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSearchResultClick(result.id)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full border border-white shadow-sm"
                        style={{
                          backgroundColor: "#3b82f6",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{result.name}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {result.type} • {result.frequency} mentions
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showSearchResults && searchResults.length === 0 && searchQuery && (
              <div className="absolute z-10 w-56 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                <p className="text-sm text-gray-500">No concepts found for "{searchQuery}"</p>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>

            {showFilters && (
              <div className="space-y-3 p-3 bg-white rounded border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Concept Types</label>
                  <div className="space-y-1">
                    {["concept", "technology", "person", "organization", "methodology"].map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.types.includes(type)}
                          onChange={(e) => {
                            const newTypes = e.target.checked
                              ? [...filters.types, type]
                              : filters.types.filter((t) => t !== type)
                            applyFilters({ ...filters, types: newTypes })
                          }}
                          className="h-3 w-3 text-blue-600 rounded"
                        />
                        <span className="ml-2 text-xs text-gray-600 capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Min Frequency: {filters.minFrequency}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={filters.minFrequency}
                    onChange={(e) => applyFilters({ ...filters, minFrequency: Number(e.target.value) })}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Abstraction Level Slider */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Abstraction Level: {abstractionLevel}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={abstractionLevel}
              onChange={(e) => setAbstractionLevel(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>All Concepts</span>
              <span>Core Only</span>
            </div>
          </div>

          {/* Stats */}
          {conceptStats && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Statistics</h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Total Concepts:</span>
                  <span className="font-medium">{conceptStats.totalConcepts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Frequency:</span>
                  <span className="font-medium">{conceptStats.averageFrequency.toFixed(1)}</span>
                </div>
                <div className="space-y-1">
                  <span className="block">By Type:</span>
                  {Object.entries(conceptStats.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between ml-2">
                      <span className="capitalize">{type}:</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">How to Use</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Search for specific concepts</li>
              <li>• Click nodes to explore details</li>
              <li>• Drag nodes to reposition</li>
              <li>• Adjust abstraction to filter</li>
              <li>• Blue nodes = your analyzed content</li>
            </ul>
          </div>

          {/* Legend */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Node Types</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
                <span className="text-xs text-gray-600">Your Content</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400 border border-white"></div>
                <span className="text-xs text-gray-600">Historical</span>
              </div>
            </div>
          </div>

          {/* Selected Node Info */}
          {selectedNodeId && (
            <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded">
              <p className="font-medium">Selected:</p>
              <p className="truncate">{selectedNodeId}</p>
            </div>
          )}
        </div>

        {/* Main graph area */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg relative overflow-hidden">
          <ConceptMap
            abstractionLevel={abstractionLevel}
            searchQuery={searchQuery}
            onNodeSelect={setSelectedNodeId}
            selectedNodeId={selectedNodeId}
            filters={filters}
          />

          {/* Concept Details Sidebar */}
          <ConceptDetailsSidebar
            selectedNodeId={selectedNodeId}
            onClose={() => setSelectedNodeId(null)}
            onConceptClick={handleConceptClick}
          />
        </div>
      </div>
    </div>
  )
}
