import type { NextRequest } from "next/server"
import { supabase } from "@/lib/database/supabase-client"

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
      // Get the authorization header
      const authHeader = request.headers.get("authorization")
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }

      const token = authHeader.substring(7) // Remove "Bearer " prefix

      // Verify the token with Supabase
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token)

      if (error || !user) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Get user profile from our users table
      const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single()

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email || "",
        name: profile?.name || "",
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
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null
    }

    const token = authHeader.substring(7)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return null
    }

    const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single()

    return {
      id: user.id,
      email: user.email || "",
      name: profile?.name || "",
    }
  } catch (error) {
    console.error("Get current user error:", error)
    return null
  }
}
