import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Fetch the content from the URL
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Pensive Content Analyzer/1.0",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.statusText}`)
    }

    const html = await response.text()

    // Basic HTML parsing to extract title and content
    // In a production app, you'd want to use a proper HTML parser like cheerio
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : "Untitled"

    // Simple content extraction (you'd want something more sophisticated)
    const contentMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    let content = contentMatch ? contentMatch[1] : html

    // Remove HTML tags and clean up
    content = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    // Limit content length for analysis
    if (content.length > 10000) {
      content = content.substring(0, 10000) + "..."
    }

    return NextResponse.json({
      title,
      content,
      url,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fetching content:", error)
    return NextResponse.json({ error: "Failed to fetch content from URL" }, { status: 500 })
  }
}
