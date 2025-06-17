import type { NextRequest } from "next/server"
import { mockAuth } from "@/lib/auth/mock-auth"

export interface AuthenticatedUser {
  id: string
  email: string
  name?: string
}

export function createAuthenticatedHandler(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>,
) {
  return async (request: NextRequest) => {
    try {
      // For preview, always use mock user
      const mockUser = mockAuth.getCurrentUser()

      if (!mockUser) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }

      const authenticatedUser: AuthenticatedUser = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      }

      return await handler(request, authenticatedUser)
    } catch (error) {
      console.error("Authentication error:", error)
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }
}

export async function getCurrentUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const mockUser = mockAuth.getCurrentUser()

    if (!mockUser) {
      return null
    }

    return {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
    }
  } catch (error) {
    console.error("Get current user error:", error)
    return null
  }
}
