import { type NextRequest, NextResponse } from "next/server"

interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
  guid: string
}

interface RSSFeed {
  title: string
  description: string
  link: string
  items: RSSItem[]
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    console.log(`Fetching RSS feed: ${url}`)

    // Fetch the RSS feed
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Pensive RSS Reader/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`)
    }

    const xmlText = await response.text()

    // Parse RSS XML (basic parsing - in production you'd use a proper XML parser)
    const feed = parseRSSXML(xmlText)

    console.log(`Successfully parsed RSS feed: ${feed.title} (${feed.items.length} items)`)

    return NextResponse.json(feed)
  } catch (error) {
    console.error("Error fetching RSS feed:", error)
    return NextResponse.json({ error: "Failed to fetch or parse RSS feed" }, { status: 500 })
  }
}

function parseRSSXML(xmlText: string): RSSFeed {
  // Basic RSS parsing - in production, use a proper XML parser like 'fast-xml-parser'
  const feed: RSSFeed = {
    title: "Unknown Feed",
    description: "",
    link: "",
    items: [],
  }

  try {
    // Extract feed title
    const titleMatch = xmlText.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
      feed.title = (titleMatch[1] || titleMatch[2] || "").trim()
    }

    // Extract feed description
    const descMatch = xmlText.match(
      /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i,
    )
    if (descMatch) {
      feed.description = (descMatch[1] || descMatch[2] || "").trim()
    }

    // Extract feed link
    const linkMatch = xmlText.match(/<link[^>]*>(.*?)<\/link>/i)
    if (linkMatch) {
      feed.link = linkMatch[1].trim()
    }

    // Extract items
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || []

    feed.items = itemMatches.slice(0, 20).map((itemXml, index) => {
      // Limit to 20 items
      const item: RSSItem = {
        title: "Untitled",
        link: "",
        description: "",
        pubDate: new Date().toISOString(),
        guid: `item-${index}`,
      }

      // Extract item title
      const itemTitleMatch = itemXml.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i)
      if (itemTitleMatch) {
        item.title = (itemTitleMatch[1] || itemTitleMatch[2] || "").trim()
      }

      // Extract item link
      const itemLinkMatch = itemXml.match(/<link[^>]*>(.*?)<\/link>/i)
      if (itemLinkMatch) {
        item.link = itemLinkMatch[1].trim()
      }

      // Extract item description
      const itemDescMatch = itemXml.match(
        /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i,
      )
      if (itemDescMatch) {
        item.description = (itemDescMatch[1] || itemDescMatch[2] || "").trim()
        // Remove HTML tags from description
        item.description = item.description
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      }

      // Extract publication date
      const pubDateMatch = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i)
      if (pubDateMatch) {
        try {
          item.pubDate = new Date(pubDateMatch[1].trim()).toISOString()
        } catch {
          item.pubDate = new Date().toISOString()
        }
      }

      // Extract GUID
      const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/i)
      if (guidMatch) {
        item.guid = guidMatch[1].trim()
      } else {
        item.guid = item.link || `item-${Date.now()}-${index}`
      }

      return item
    })

    // Sort items by publication date (newest first)
    feed.items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
  } catch (error) {
    console.error("Error parsing RSS XML:", error)
    throw new Error("Failed to parse RSS feed")
  }

  return feed
}
