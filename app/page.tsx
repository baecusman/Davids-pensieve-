"use client"

import { useState, useEffect } from "react"
import { simpleAuth } from "@/lib/auth/simple-auth"
import { userSegmentedDatabase } from "@/lib/database/user-segmented-database"
import { performanceMonitor } from "@/lib/performance-monitor"
import SimpleLogin from "@/components/auth/simple-login"
import Navigation from "@/components/navigation"
import DigestsView from "@/components/views/digests-view"
import ConceptMapView from "@/components/views/concept-map-view"
import SourceManagementView from "@/components/views/source-management-view"
import SettingsView from "@/components/views/settings-view"
import ErrorBoundary from "@/components/error-boundary"

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeView, setActiveView] = useState<"digests" | "concept-map" | "source-management" | "settings">("digests")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = performanceMonitor.startTimer("auth-check")

    if (simpleAuth.isAuthenticated()) {
      const user = simpleAuth.getCurrentUser()
      if (user) {
        setCurrentUser(user)

        // Migrate existing data if needed
        const migrationResult = userSegmentedDatabase.migrateExistingData()
        if (migrationResult.migrated > 0) {
          console.log(`Migrated ${migrationResult.migrated} records for user segmentation`)
        }
      }
    }

    timer()
    setIsLoading(false)
  }, [])

  const handleLogin = (user: any) => {
    const timer = performanceMonitor.startTimer("login")
    setCurrentUser(user)

    // Extend session on activity
    simpleAuth.extendSession()
    timer()
  }

  const handleLogout = () => {
    const timer = performanceMonitor.startTimer("logout")
    simpleAuth.logout()
    setCurrentUser(null)
    setActiveView("digests")
    timer()
  }

  const renderActiveView = () => {
    const timer = performanceMonitor.startTimer("render")

    let component
    switch (activeView) {
      case "digests":
        component = <DigestsView />
        break
      case "concept-map":
        component = <ConceptMapView />
        break
      case "source-management":
        component = <SourceManagementView />
        break
      case "settings":
        component = <SettingsView />
        break
      default:
        component = <DigestsView />
    }

    timer()
    return component
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Pensive...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <SimpleLogin onLogin={handleLogin} />
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Navigation activeView={activeView} onViewChange={setActiveView} user={currentUser} onLogout={handleLogout} />
        <main>{renderActiveView()}</main>
      </div>
    </ErrorBoundary>
  )
}
