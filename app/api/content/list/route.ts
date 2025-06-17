import type { NextRequest } from "next/server"
import { createAuthenticatedHandler } from "@/lib/auth/auth-utils"
import { contentService } from "@/lib/services/content-service"

export const GET = createAuthenticatedHandler(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)

    const options = {
      page: Number.parseInt(searchParams.get("page") || "1"),
      limit: Number.parseInt(searchParams.get("limit") || "50"),
      source: searchParams.get("source") || undefined,
      priority: searchParams.get("priority") || undefined,
      timeframe: (searchParams.get("timeframe") as any) || undefined,
    }

    const content = await contentService.getUserContent(user.id, options)

    return new Response(JSON.stringify(content), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    console.error("Content list error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch content" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
