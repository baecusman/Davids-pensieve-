"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/navigation"
import DigestsView from "@/components/views/digests-view"
import ConceptMapView from "@/components/views/concept-map-view"
import SourceManagementView from "@/components/views/source-management-view"
import SettingsView from "@/components/views/settings-view"
import SimpleLogin from "@/components/auth/simple-login"
import { simpleAuth } from "@/lib/auth/simple-auth"

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [activeView, setActiveView] = useState<"digests" | "concept-map" | "source-management" | "settings">("digests")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const currentUser = simpleAuth.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (userData: any) => {
    setUser(userData)
  }

  const handleLogout = () => {
    simpleAuth.logout()
    setUser(null)
    setActiveView("digests")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold">P</span>
          </div>
          <p className="text-gray-600">Loading Pensive...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <SimpleLogin onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeView={activeView} onViewChange={setActiveView} user={user} onLogout={handleLogout} />

      <main className="pb-8">
        {activeView === "digests" && <DigestsView />}
        {activeView === "concept-map" && <ConceptMapView />}
        {activeView === "source-management" && <SourceManagementView />}
        {activeView === "settings" && <SettingsView />}
      </main>
    </div>
  )
}
