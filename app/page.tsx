"use client"

import { useAuth } from "@/components/auth/auth-provider"
import LoginPage from "@/components/auth/login-page"
import DigestsViewV2 from "@/components/views/digests-view-v2"
import Navigation from "@/components/navigation"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main>
        <DigestsViewV2 />
      </main>
    </div>
  )
}
