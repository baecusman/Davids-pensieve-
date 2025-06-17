"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { LoginPage } from "@/components/auth/login-page"
import { Navigation } from "@/components/navigation"
import { useState } from "react"
import SourceManagementView from "@/components/views/source-management-view"
import { DigestsView } from "@/components/views/digests-view"
import ConceptMapView from "@/components/views/concept-map-view"
import { SettingsView } from "@/components/views/settings-view"

export default function Home() {
  const { user, loading } = useAuth()
  const [activeView, setActiveView] = useState("sources")

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

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
      <main className="container mx-auto px-4 py-8">{renderView()}</main>
    </div>
  )
}
