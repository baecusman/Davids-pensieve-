"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Network, TrendingUp, Search, Filter } from "lucide-react"
import { mockDb, type Concept } from "@/lib/database/mock-db"
import { useAuth } from "@/components/auth/auth-provider"

export default function ConceptMapView() {
  const { user } = useAuth()
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [filteredConcepts, setFilteredConcepts] = useState<Concept[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadConcepts()
  }, [user])

  useEffect(() => {
    filterConcepts()
  }, [concepts, searchQuery, selectedType])

  const loadConcepts = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const userConcepts = await mockDb.concept.findByUserId(user.id)
      setConcepts(userConcepts.sort((a, b) => b.frequency - a.frequency))
    } catch (error) {
      console.error("Error loading concepts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterConcepts = () => {
    let filtered = concepts

    if (searchQuery) {
      filtered = filtered.filter(
        (concept) =>
          concept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          concept.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((concept) => concept.type === selectedType)
    }

    setFilteredConcepts(filtered)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "TECHNOLOGY":
        return "bg-blue-100 text-blue-800"
      case "METHODOLOGY":
        return "bg-green-100 text-green-800"
      case "PERSON":
        return "bg-purple-100 text-purple-800"
      case "ORGANIZATION":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const uniqueTypes = Array.from(new Set(concepts.map((c) => c.type)))

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

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Network className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Concepts</p>
                <p className="text-2xl font-bold text-gray-900">{concepts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Frequency</p>
                <p className="text-2xl font-bold text-gray-900">
                  {concepts.length > 0
                    ? Math.round(concepts.reduce((sum, c) => sum + c.frequency, 0) / concepts.length)
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Types</p>
                <p className="text-2xl font-bold text-gray-900">{uniqueTypes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Concepts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredConcepts.map((concept) => (
          <Card key={concept.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{concept.name}</CardTitle>
                <Badge className={getTypeColor(concept.type)}>{concept.type}</Badge>
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

              {/* Frequency Bar */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((concept.frequency / Math.max(...concepts.map((c) => c.frequency))) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredConcepts.length === 0 && concepts.length > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No concepts found</h3>
            <p className="text-gray-600 text-center">Try adjusting your search query or filter settings.</p>
          </CardContent>
        </Card>
      )}

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
