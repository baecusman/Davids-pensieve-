"use client"

import { useState, useEffect } from "react"
// import { simpleAuth } from "@/lib/auth/simple-auth" // Removed
// import { userSegmentedDatabase } from "@/lib/database/user-segmented-database" // Removed
import { performanceMonitor } from "@/lib/performance-monitor"
// import SimpleLogin from "@/components/auth/simple-login" // Removed
import LoginForm from "@/components/auth/login-form" // Added
import { useAuth } from "@/components/auth/auth-provider" // Added
import Navigation from "@/components/navigation"
import DigestsView from "@/components/views/digests-view"
import ConceptMapView from "@/components/views/concept-map-view"
import SourceManagementView from "@/components/views/source-management-view"
import SettingsView from "@/components/views/settings-view"
import ErrorBoundary from "@/components/error-boundary"

export default function Home() {
  const auth = useAuth();
  // const [currentUser, setCurrentUser] = useState<any>(null) // Replaced by auth.user
  const [activeView, setActiveView] = useState<"digests" | "concept-map" | "source-management" | "settings">("digests")
  // const [isLoading, setIsLoading] = useState(true) // Replaced by auth.isLoading for auth part

  // Initial effect to check auth state is now handled by AuthProvider
  // The userSegmentedDatabase.migrateExistingData() is obsolete.

  // This function might still be useful if LoginForm needs to trigger something specific in this component
  // upon successful login, beyond what AuthProvider already does (setting global user state).
  // For now, it's simplified as AuthProvider handles the user state.
  const handleLogin = (supabaseUser: any) => {
    const timer = performanceMonitor.startTimer("login-callback")
    console.log("Login callback in Home page, user:", supabaseUser?.email)
    // setCurrentUser(user) // Not needed, auth.user will update
    // simpleAuth.extendSession() // Obsolete
    timer()
    // Potentially set a default view or trigger other post-login actions if needed
    setActiveView("digests");
  }

  const handleLogout = async () => {
    const timer = performanceMonitor.startTimer("logout")
    try {
      await auth.signOut()
      // setCurrentUser(null) // Not needed, auth.user will update
      setActiveView("digests") // Reset view on logout
    } catch (error) {
      console.error("Error during logout:", error)
      // Handle logout error if necessary
    }
    timer()
  }

  const renderActiveView = () => {
    const timer = performanceMonitor.startTimer("render-active-view")
    let component
    switch (activeView) {
      case "digests": component = <DigestsView />; break;
      case "concept-map": component = <ConceptMapView />; break;
      case "source-management": component = <SourceManagementView />; break;
      case "settings": component = <SettingsView />; break;
      default: component = <DigestsView />;
    }
    timer()
    return component
  }

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Pensive...</p>
        </div>
      </div>
    )
  }

  if (!auth.user) {
    // Pass a simplified onLogin or adapt LoginForm if it no longer needs it.
    // If LoginForm directly updates global state via useAuth and handles navigation/UI changes,
    // onLogin might not be strictly necessary here.
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Pass auth.user to Navigation, ensure Navigation is adapted for Supabase user object */}
        <Navigation activeView={activeView} onViewChange={setActiveView} user={auth.user} onLogout={handleLogout} />
        <main>{renderActiveView()}</main>
      </div>
    </ErrorBoundary>
  )
}
