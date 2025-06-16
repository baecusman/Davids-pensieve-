"use client"

import { useState, useEffect } from "react"
import { simpleAuth } from "@/lib/auth/simple-auth"
import { userSegmentedDatabase } from "@/lib/database/user-segmented-database"
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      console.log("App initializing...")

      // Initialize client-side services only after component mounts
      if (typeof window !== "undefined") {
        console.log("Initializing auth...")
        simpleAuth.initialize()

        console.log("Checking authentication...")
        if (simpleAuth.isAuthenticated()) {
          const user = simpleAuth.getCurrentUser()
          console.log("User found:", user?.username)
          if (user) {
            setCurrentUser(user)

            // Try to migrate existing data if needed
            try {
              const migrationResult = userSegmentedDatabase.migrateExistingData()
              if (migrationResult.migrated > 0) {
                console.log(`Migrated ${migrationResult.migrated} records for user segmentation`)
              }
            } catch (migrationError) {
              console.warn("Migration failed:", migrationError)
              // Don't crash the app for migration failures
            }
          }
        }
      }

      setIsLoading(false)
    } catch (error) {
      console.error("App initialization error:", error)
      setError(error instanceof Error ? error.message : "Failed to initialize app")
      setIsLoading(false)
    }
  }, [])

  const handleLogin = (user: any) => {
    try {
      console.log("Handling login for:", user?.username)
      setCurrentUser(user)
      setError(null)

      // Extend session on activity
      simpleAuth.extendSession()
    } catch (error) {
      console.error("Login error:", error)
      setError("Login failed")
    }
  }

  const handleLogout = () => {
    try {
      console.log("Handling logout")
      simpleAuth.logout()
      setCurrentUser(null)
      setActiveView("digests")
      setError(null)
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const renderActiveView = () => {
    try {
      switch (activeView) {
        case "digests":
          return <DigestsView />
        case "concept-map":
          return <ConceptMapView />
        case "source-management":
          return <SourceManagementView />
        case "settings":
          return <SettingsView />
        default:
          return <DigestsView />
      }
    } catch (error) {
      console.error("View render error:", error)
      return (
        <div className="p-8 text-center">
          <p className="text-red-600">Error loading view: {error instanceof Error ? error.message : "Unknown error"}</p>
          <button onClick={() => setActiveView("digests")} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Return to Digests
          </button>
        </div>
      )
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <p className="text-xl font-semibold">App Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => {
              setError(null)
              window.location.reload()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Reload App
          </button>
        </div>
      </div>
    )
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
