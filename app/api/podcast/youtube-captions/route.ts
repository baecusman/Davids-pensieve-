import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get("videoId")

    if (!videoId) {
      return NextResponse.json({ error: "videoId parameter is required" }, { status: 400 })
    }

    // Try to get auto-generated captions from YouTube
    // This is a simplified approach - in production you'd use YouTube API
    const captionUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=srv3`

    try {
      const response = await fetch(captionUrl)

      if (!response.ok) {
        return NextResponse.json({ error: "No captions available" }, { status: 404 })
      }

      const captionData = await response.text()

      // Parse the caption data (simplified)
      const captions = this.parseCaptions(captionData)

      return NextResponse.json({ captions })
    } catch (error) {
      // Fallback: try to extract from video page
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
      const pageResponse = await fetch(videoUrl)
      const html = await pageResponse.text()

      // Look for transcript in the page (YouTube sometimes includes it)
      const transcriptMatch = html.match(/"transcriptRenderer":\s*{[^}]+}/g)

      if (transcriptMatch) {
        // Extract and clean transcript
        const transcript = this.extractTranscriptFromMatch(transcriptMatch[0])
        return new NextResponse(transcript, {
          headers: { "Content-Type": "text/plain" },
        })
      }

      return NextResponse.json({ error: "No captions found" }, { status: 404 })
    }
  } catch (error) {
    console.error("Error getting YouTube captions:", error)
    return NextResponse.json({ error: "Failed to get YouTube captions" }, { status: 500 })
  }
}

function parseCaptions(captionData: string): string {
  try {
    // Parse XML caption format
    const parser = new DOMParser()
    const doc = parser.parseFromString(captionData, "text/xml")
    const textElements = doc.querySelectorAll("text")

    let transcript = ""
    textElements.forEach((element) => {
      const text = element.textContent?.trim()
      if (text) {
        transcript += text + " "
      }
    })

    return transcript.trim()
  } catch (error) {
    console.error("Error parsing captions:", error)
    return ""
  }
}

function extractTranscriptFromMatch(match: string): string {
  try {
    // Extract text from transcript renderer JSON
    const textMatches = match.match(/"text":"([^"]+)"/g)
    if (!textMatches) return ""

    let transcript = ""
    textMatches.forEach((textMatch) => {
      const text = textMatch.replace(/"text":"([^"]+)"/, "$1")
      transcript += text + " "
    })

    return transcript.trim()
  } catch (error) {
    console.error("Error extracting transcript:", error)
    return ""
  }
}
