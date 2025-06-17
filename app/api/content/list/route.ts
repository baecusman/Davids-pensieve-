import type { NextRequest } from "next/server"
import { supabaseContentService } from "@/lib/services/supabase-content-service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const source = searchParams.get("source") || undefined
    const priority = searchParams.get("priority") || undefined
    const timeframe = searchParams.get("timeframe") as "weekly" | "monthly" | "quarterly" | undefined

    const offset = (page - 1) * limit

    const result = await supabaseContentService.getUserContent({
      limit,
      offset,
      source,
      priority,
      timeframe,
    })

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Content list error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch content" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
