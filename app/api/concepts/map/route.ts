import type { NextRequest } from "next/server"
import { supabaseContentService } from "@/lib/services/supabase-content-service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const abstractionLevel = parseInt(searchParams.get("abstractionLevel") || "50")
    const searchQuery = searchParams.get("search") || ""

    const result = await supabaseContentService.getConceptMapData(abstractionLevel, searchQuery)

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Concept map error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch concept map" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
