import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get("url")
    const lastChecked = searchParams.get("lastChecked")

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    const lastCheckedDate = lastChecked ? new Date(lastChecked) : new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Determine how to get episodes based on platform
    if (url.includes("spotify.com")) {
      return await getSpotifyEpisodes(url, lastCheckedDate)
    } else if (url.includes("podcasts.apple.com")) {
      return await getAppleEpisodes(url, lastCheckedDate)
    } else if (url.includes("youtube.com")) {
      return await getYouTubeEpisodes(url, lastCheckedDate)
    } else {
      // Assume RSS feed
      return await getRSSEpisodes(url, lastCheckedDate)
    }
  } catch (error) {
    console.error("Error getting latest episodes:", error)
    return NextResponse.json({ error: "Failed to get latest episodes" }, { status: 500 })
  }
}

async function getSpotifyEpisodes(url: string, lastChecked: Date) {
  try {
    // For Spotify, we'd need to find the RSS feed or use their API
    // This is a simplified implementation
    const response = await fetch(url)
    const html = await response.text()

    // Look for episode links in the page
    const episodeMatches = html.match(/\/episode\/[a-zA-Z0-9]+/g)

    if (!episodeMatches) {
      return NextResponse.json([])
    }

    const episodes = episodeMatches.slice(0, 5).map((match, index) => ({
      id: match.replace("/episode/", ""),
      title: `Recent Episode ${index + 1}`,
      url: `https://open.spotify.com${match}`,
      publishedAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
      description: "Episode description would be extracted from individual episode pages",
    }))

    // Filter episodes newer than lastChecked
    const newEpisodes = episodes.filter((ep) => new Date(ep.publishedAt) > lastChecked)

    return NextResponse.json(newEpisodes)
  } catch (error) {
    console.error("Error getting Spotify episodes:", error)
    return NextResponse.json([])
  }
}

async function getAppleEpisodes(url: string, lastChecked: Date) {
  try {
    // Similar approach for Apple Podcasts
    const response = await fetch(url)
    const html = await response.text()

    // Apple Podcasts structure is different, would need specific parsing
    return NextResponse.json([])
  } catch (error) {
    console.error("Error getting Apple episodes:", error)
    return NextResponse.json([])
  }
}

async function getYouTubeEpisodes(url: string, lastChecked: Date) {
  try {
    // For YouTube channels/playlists
    const response = await fetch(url)
    const html = await response.text()

    // Extract video IDs from the page
    const videoMatches = html.match(/watch\?v=([a-zA-Z0-9_-]+)/g)

    if (!videoMatches) {
      return NextResponse.json([])
    }

    const episodes = videoMatches.slice(0, 10).map((match, index) => {
      const videoId = match.replace("watch?v=", "")
      return {
        id: videoId,
        title: `Recent Video ${index + 1}`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
        description: "Video description would be extracted from individual video pages",
      }
    })

    const newEpisodes = episodes.filter((ep) => new Date(ep.publishedAt) > lastChecked)

    return NextResponse.json(newEpisodes)
  } catch (error) {
    console.error("Error getting YouTube episodes:", error)
    return NextResponse.json([])
  }
}

async function getRSSEpisodes(url: string, lastChecked: Date) {
  try {
    const response = await fetch(url)
    const xml = await response.text()

    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "text/xml")

    const items = doc.querySelectorAll("item")
    const episodes = []

    for (const item of Array.from(items).slice(0, 10)) {
      const title = item.querySelector("title")?.textContent || "Unknown Episode"
      const description = item.querySelector("description")?.textContent || ""
      const pubDate = item.querySelector("pubDate")?.textContent || new Date().toISOString()
      const guid = item.querySelector("guid")?.textContent || `rss_${Date.now()}_${Math.random()}`
      const enclosure = item.querySelector("enclosure")

      const episode = {
        id: guid,
        title: title.trim(),
        description: description.trim(),
        url: url, // RSS feed URL
        publishedAt: new Date(pubDate).toISOString(),
        audioUrl: enclosure?.getAttribute("url") || undefined,
      }

      if (new Date(episode.publishedAt) > lastChecked) {
        episodes.push(episode)
      }
    }

    return NextResponse.json(episodes)
  } catch (error) {
    console.error("Error getting RSS episodes:", error)
    return NextResponse.json([])
  }
}
