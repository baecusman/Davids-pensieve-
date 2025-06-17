"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { mockAuth, type MockUser } from "@/lib/auth/mock-auth"
import { initializeSampleData } from "@/lib/database/mock-db"

interface AuthContextType {
  user: MockUser | null
  loading: boolean
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = mockAuth.onAuthStateChange((user) => {
      setUser(user)
      setLoading(false)

      // Initialize sample data when user signs in
      if (user) {
        initializeSampleData(user.id)
      }
    })

    // Check if user is already signed in
    const currentUser = mockAuth.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      initializeSampleData(currentUser.id)
    }
    setLoading(false)

    return unsubscribe
  }, [])

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true)
    try {
      await mockAuth.signUp(email, password, name)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      await mockAuth.signIn(email, password)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await mockAuth.signOut()
  }

  return <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
