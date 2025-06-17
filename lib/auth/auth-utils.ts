import { createServerSupabaseClient } from "./supabase"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/database/prisma"

export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get the authorization header
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return null
    }

    const token = authHeader.substring(7)

    // Verify the JWT token
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return null
    }

    // Ensure user exists in our database
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    })

    if (!dbUser) {
      // Create user in our database if they don't exist
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
          preferences: {},
        },
      })
    }

    return dbUser
  } catch (error) {
    console.error("Authentication error:", error)
    return null
  }
}

export function createAuthenticatedHandler<T = any>(handler: (request: NextRequest, user: any) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    return handler(request, user)
  }
}
