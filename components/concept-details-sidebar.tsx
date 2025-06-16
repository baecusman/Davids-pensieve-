"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, ExternalLink, Network, TrendingUp, FileText, Users } from "lucide-react"

interface ConceptNode {
  id: string
  name: string
  type: "concept" | "person" | "organization" | "technology" | "methodology"
  frequency: number
  connections: number
  color?: string
}

interface ConceptDetailsSidebarProps {
  concept: ConceptNode
  onClose: () => void
  relatedConcepts: ConceptNode[]
}

export default function ConceptDetailsSidebar({ concept, onClose, relatedConcepts }: ConceptDetailsSidebarProps) {
  const [activeTab, setActiveTab] = useState("overview")

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "person":
        return <Users className="h-4 w-4" />
      case "organization":
        return <Network className="h-4 w-4" />
      case "technology":
        return <TrendingUp className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: concept.color }} />
              {getTypeIcon(concept.type)}
              <h3 className="text-lg font-semibold text-gray-900 truncate">{concept.name}</h3>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Badge variant="secondary" className="capitalize">
                {concept.type}
              </Badge>
              <span>{concept.frequency} mentions</span>
              <span>{concept.connections} connections</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mx-6 mt-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Links</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Frequency</span>
                    <Badge variant="outline">{concept.frequency}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Connections</span>
                    <Badge variant="outline">{concept.connections}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Type</span>
                    <Badge variant="secondary" className="capitalize">
                      {concept.type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {concept.type === "person"
                      ? `${concept.name} is a person mentioned ${concept.frequency} times across your content.`
                      : concept.type === "organization"
                        ? `${concept.name} is an organization referenced ${concept.frequency} times in your knowledge base.`
                        : concept.type === "technology"
                          ? `${concept.name} is a technology discussed ${concept.frequency} times in your analyzed content.`
                          : `${concept.name} is a concept that appears ${concept.frequency} times across your content.`}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="connections" className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Related Concepts</h4>
                <div className="space-y-2">
                  {relatedConcepts.map((related) => (
                    <div
                      key={related.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: related.color }} />
                        <span className="text-sm font-medium">{related.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {related.frequency}
                        </Badge>
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {relatedConcepts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Network className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No related concepts found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Mentioned In</h4>
                <div className="space-y-3">
                  {/* Mock content references */}
                  <Card>
                    <CardContent className="p-4">
                      <h5 className="text-sm font-medium mb-1">Sample Article Title</h5>
                      <p className="text-xs text-gray-600 mb-2">This concept was mentioned in the context of...</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Article
                        </Badge>
                        <span className="text-xs text-gray-500">2 days ago</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <h5 className="text-sm font-medium mb-1">Another Reference</h5>
                      <p className="text-xs text-gray-600 mb-2">Referenced in discussion about related topics...</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Blog Post
                        </Badge>
                        <span className="text-xs text-gray-500">1 week ago</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-gray-200">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <ExternalLink className="h-4 w-4 mr-1" />
            Explore
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Network className="h-4 w-4 mr-1" />
            Focus
          </Button>
        </div>
      </div>
    </div>
  )
}
