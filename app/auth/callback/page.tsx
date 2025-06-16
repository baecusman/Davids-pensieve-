"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { googleAuth } from "@/lib/auth/google-auth"

export default function AuthCallback() {
  const [status, setStatus] = useState("Processing...")
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code")
        const state = searchParams.get("state")
        const error = searchParams.get("error")

        if (error) {
          setStatus(`Authentication failed: ${error}`)
          setTimeout(() => router.push("/"), 3000)
          return
        }

        if (!code) {
          setStatus("No authorization code received")
          setTimeout(() => router.push("/"), 3000)
          return
        }

        setStatus("Completing sign-in...")
        const user = await googleAuth.handleOAuthCallback(code, state || undefined)

        setStatus("Sign-in successful! Redirecting...")

        // Send success message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS", user }, window.location.origin)
          window.close()
        } else {
          // Redirect to main app
          router.push("/")
        }
      } catch (error) {
        console.error("Auth callback error:", error)
        setStatus(`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`)

        if (window.opener) {
          window.opener.postMessage(
            { type: "GOOGLE_AUTH_ERROR", error: error instanceof Error ? error.message : "Unknown error" },
            window.location.origin,
          )
          window.close()
        } else {
          setTimeout(() => router.push("/"), 3000)
        }
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  )
}
