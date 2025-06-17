"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { useCallback } from "react"

export function useApi() {
  const { session } = useAuth()

  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      }

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`
      }

      const response = await fetch(endpoint, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Network error" }))
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      return response.json()
    },
    [session],
  )

  return { apiCall }
}
