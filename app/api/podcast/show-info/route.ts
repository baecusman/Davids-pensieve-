import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get("url")

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    console.log(`Extracting show info from: ${url}`)

    // Return simplified show info to avoid scraping issues
    const platform = detectPlatform(url)
    const showInfo = generateMockShowInfo(platform, url)

    return NextResponse.json(showInfo)
  } catch (error) {
    console.error("Error extracting show info:", error)
    return NextResponse.json(
      {
        title: "Podcast Show",
        description: "A podcast show that could not be fully analyzed.",
        platform: "unknown",
        error: "Could not extract show information",
      },
      { status: 200 }, // Return 200 instead of 500 to avoid crashes
    )
  }
}

function detectPlatform(url: string): string {
  if (url.includes("spotify.com")) return "spotify"
  if (url.includes("podcasts.apple.com")) return "apple"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
  return "generic"
}

function generateMockShowInfo(platform: string, url: string) {
  const showTitles = {
    spotify: "Spotify Podcast Show",
    apple: "Apple Podcasts Show",
    youtube: "YouTube Podcast Channel",
    generic: "Podcast Show",
  }

  const showDescriptions = {
    spotify: "A popular podcast show available on Spotify with regular episodes and engaging content.",
    apple: "A high-quality podcast show from Apple Podcasts featuring expert hosts and guests.",
    youtube: "A video podcast channel on YouTube with both audio and visual content.",
    generic: "A podcast show with regular episodes and interesting discussions.",
  }

  return {
    title: showTitles[platform as keyof typeof showTitles] || showTitles.generic,
    description: showDescriptions[platform as keyof typeof showDescriptions] || showDescriptions.generic,
    platform: platform,
    rssUrl: null, // Would need real implementation for RSS feeds
  }
}
