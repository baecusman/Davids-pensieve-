import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get("url")

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    // Fetch the show page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PensiveBot/1.0)",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Extract show information
    const title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      doc.querySelector("title")?.textContent ||
      "Unknown Show"

    const description =
      doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
      doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
      ""

    // Look for RSS feed link
    let rssUrl = ""
    const rssLink = doc.querySelector('link[type="application/rss+xml"]')
    if (rssLink) {
      rssUrl = rssLink.getAttribute("href") || ""
    }

    // For Spotify, try to find RSS feed in page data
    if (url.includes("spotify.com") && !rssUrl) {
      const rssMatch = html.match(/rss[^"]*\.xml[^"]*/i)
      if (rssMatch) {
        rssUrl = rssMatch[0]
      }
    }

    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      rssUrl: rssUrl,
    })
  } catch (error) {
    console.error("Error extracting show info:", error)
    return NextResponse.json(
      {
        title: "Unknown Show",
        description: "Could not extract show information",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
