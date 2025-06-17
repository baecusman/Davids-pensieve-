"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { SourceManagementView } from "@/components/views/source-management-view"
import { DigestsView } from "@/components/views/digests-view"
import { ConceptMapView } from "@/components/views/concept-map-view"
import { SettingsView } from "@/components/views/settings-view"

export function PensiveApp() {
  const [activeView, setActiveView] = useState("sources")

  const renderView = () => {
    switch (activeView) {
      case "sources":
        return <SourceManagementView />
      case "digests":
        return <DigestsView />
      case "concepts":
        return <ConceptMapView />
      case "settings":
        return <SettingsView />
      default:
        return <SourceManagementView />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeView={activeView} onViewChange={setActiveView} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderView()}</main>
    </div>
  )
}
