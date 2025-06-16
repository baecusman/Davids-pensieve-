"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, FileText, Rss, Settings } from "lucide-react"
import SourceManagementView from "@/components/views/source-management-view"
import DigestsView from "@/components/views/digests-view"
import ConceptMapView from "@/components/views/concept-map-view"
import SettingsView from "@/components/views/settings-view"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("sources")

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Pensive</h1>
          </div>
          <p className="text-gray-600">AI-powered knowledge management and content analysis</p>
        </div>

        {/* Main Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <Rss className="h-4 w-4" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="digests" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Digests
            </TabsTrigger>
            <TabsTrigger value="concepts" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Concepts
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources">
            <SourceManagementView />
          </TabsContent>

          <TabsContent value="digests">
            <DigestsView />
          </TabsContent>

          <TabsContent value="concepts">
            <ConceptMapView />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
