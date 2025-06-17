import type { NextRequest } from "next/server"
import { createAuthenticatedHandler } from "@/lib/auth/auth-utils"
import { contentService } from "@/lib/services/content-service"

export const GET = createAuthenticatedHandler(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)

    const abstractionLevel = Number.parseInt(searchParams.get("abstractionLevel") || "50")
    const searchQuery = searchParams.get("search") || ""

    const conceptMap = await contentService.getConceptMap(user.id, abstractionLevel, searchQuery)

    return new Response(JSON.stringify(conceptMap), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    console.error("Concept map error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch concept map" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
