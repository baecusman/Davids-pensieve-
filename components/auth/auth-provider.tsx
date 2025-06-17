"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { mockAuth, type MockUser } from "@/lib/auth/mock-auth"

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
    // Initialize with mock user
    const currentUser = mockAuth.getCurrentUser()
    setUser(currentUser)
    setLoading(false)

    // Set up auth state change listener
    const unsubscribe = mockAuth.onAuthStateChange((user) => {
      setUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true)
    try {
      const user = await mockAuth.signUp(email, password, name)
      setUser(user)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const user = await mockAuth.signIn(email, password)
      setUser(user)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await mockAuth.signOut()
    setUser(null)
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
