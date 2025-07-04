import { type NextRequest, NextResponse } from "next/server";
import { parseStringPromise as parseXmlString } from 'xml2js';
import * as cheerio from 'cheerio';
import { z } from 'zod';

// Zod schema for query parameters
const youtubeCaptionsParamsSchema = z.object({
  videoId: z.string().min(1, { message: "videoId parameter is required" })
    // Basic regex for YouTube video ID format, can be made more strict
    .regex(/^[a-zA-Z0-9_-]{11}$/, { message: "Invalid YouTube videoId format" }),
});

// Function to parse YouTube's timedtext XML (srv3 format is often XML-like)
async function parseSrv3Captions(xmlData: string): Promise<string> {
  try {
    // YouTube's srv3 can sometimes be simple text lines or more structured XML.
    // This parser handles a common XML structure for <text> elements.
    const result = await parseXmlString(xmlData, { explicitArray: false, explicitRoot: false });
    let transcript = "";
    if (result && result.text) { // Check if result.text exists
      const texts = Array.isArray(result.text) ? result.text : [result.text];
      texts.forEach((textSegment: any) => {
        if (textSegment && typeof textSegment._ === 'string') { // Check textSegment and its _ property
          // Clean up common HTML entities that might appear decoded
          const cleanedText = textSegment._
            .replace(/&amp;#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
            .replace(/<\/?i>/g, '') // Remove italics tags
            .replace(/<\/?b>/g, '') // Remove bold tags
            .replace(/<\/?font[^>]*>/g, '') // Remove font tags
            .replace(/&#39;/g, "'"); // Standard HTML entity for apostrophe
          transcript += cleanedText + " ";
        } else if (textSegment && typeof textSegment === 'string') { // Fallback if structure is simpler
           transcript += textSegment + " ";
        }
      });
    }
    return transcript.replace(/\s+/g, ' ').trim(); // Normalize whitespace
  } catch (error) {
    console.error("Error parsing SRV3/XML caption data:", error);
    // If XML parsing fails, try to extract text content more directly as a fallback
    // This handles cases where srv3 might not be well-formed XML but contains text lines
    const lines = xmlData.split('\n').map(line => {
        // Basic cleaning of lines that might be caption text
        return line.replace(/<[^>]+>/g, '').replace(/&amp;#39;/g, "'").replace(/&#39;/g, "'").trim();
    }).filter(line => line.length > 0);
    if(lines.length > 0) return lines.join(' ');

    return ""; // Return empty if all parsing fails
  }
}

// Function to extract transcript from embedded JSON in YouTube page HTML
function extractTranscriptFromHtml(html: string): string | null {
  try {
    const $ = cheerio.load(html);
    // YouTube often embeds player response data in a script tag
    let playerResponseJson: any = null;
    $('script').each((i, el) => {
      const scriptContent = $(el).html();
      if (scriptContent && scriptContent.includes('var ytInitialPlayerResponse = {')) {
        const match = scriptContent.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match && match[1]) {
          playerResponseJson = JSON.parse(match[1]);
          return false; // Break loop
        }
      }
      // Another common pattern
      if (scriptContent && scriptContent.includes('window["ytInitialPlayerResponse"] = {')) {
         const match = scriptContent.match(/window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/);
        if (match && match[1]) {
          playerResponseJson = JSON.parse(match[1]);
          return false; // Break loop
        }
      }
    });

    if (playerResponseJson && playerResponseJson.captions && playerResponseJson.captions.playerCaptionsTracklistRenderer) {
      const tracks = playerResponseJson.captions.playerCaptionsTracklistRenderer.captionTracks;
      if (tracks && tracks.length > 0) {
        // Prefer English, find 'en' language code or a simple kind if available
        const englishTrack = tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr') || // Prefer non-ASR
                             tracks.find((t: any) => t.languageCode === 'en') ||
                             tracks.find((t: any) => t.kind !== 'asr') || // Any non-ASR
                             tracks[0]; // Fallback to the first available track

        if (englishTrack && englishTrack.baseUrl) {
          // This would require another fetch to get the actual caption data from englishTrack.baseUrl
          // For simplicity in this step, we are not making that second fetch here.
          // The initial timedtext API call is the primary method for this.
          // This HTML fallback is more for finding *if* a transcript exists and where.
          console.log("Found caption track URL in HTML, but direct fetch is preferred:", englishTrack.baseUrl);
          return "Transcript URL found in HTML, but requires another fetch. Primary API method is preferred.";
        }
      }
    }
    // The old regex approach as a last resort for the specific "transcriptRenderer" pattern
     const transcriptMatch = html.match(/"transcriptRenderer":\s*({.+?"runs":\[.+?\][^}]*})/sg);
     if (transcriptMatch) {
        try {
            const transcriptJson = JSON.parse(transcriptMatch[0].replace('"transcriptRenderer":', ''));
            if (transcriptJson.content && transcriptJson.content.transcriptSearchPanelRenderer && transcriptJson.content.transcriptSearchPanelRenderer.body && transcriptJson.content.transcriptSearchPanelRenderer.body.transcriptSegmentListRenderer) {
                const segments = transcriptJson.content.transcriptSearchPanelRenderer.body.transcriptSegmentListRenderer.initialSegments;
                return segments.map((seg: any) => seg.transcriptSegmentRenderer.snippet.runs.map((run:any) => run.text).join('')).join(' ').replace(/\s+/g, ' ').trim();
            }
        } catch(e) {
            console.warn("Could not parse transcriptRenderer JSON from HTML fallback", e);
        }
     }


    return null;
  } catch (error) {
    console.error("Error extracting transcript from HTML:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const originalVideoIdParam = new URL(request.url).searchParams.get('videoId'); // For logging in catch
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validationResult = youtubeCaptionsParamsSchema.safeParse(params);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { videoId } = validationResult.data; // Use validated videoId

    const captionUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=srv3`;
    let captionsText = "";

    try {
      console.log(`Attempting to fetch captions from API: ${captionUrl}`);
      const response = await fetch(captionUrl);

      if (response.ok) {
        const captionData = await response.text();
        if (captionData && captionData.trim().length > 0) {
            captionsText = await parseSrv3Captions(captionData);
        }
      } else {
         console.warn(`Caption API for ${videoId} responded with ${response.status}.`);
      }

      if (captionsText && captionsText.trim().length > 0) {
        return NextResponse.json({ captions: captionsText.trim() });
      }
      // If API fetch failed or returned empty captions, log and proceed to fallback
      console.log(`No captions from API for ${videoId} or parsing failed, trying HTML fallback.`);

    } catch (apiError) {
      console.error(`Error fetching/parsing captions from API for ${videoId}:`, apiError);
      // Proceed to HTML fallback
    }

    // Fallback: try to extract from video page HTML
    console.log(`Attempting HTML fallback for captions for video ID: ${videoId}`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }}); // Add User-Agent
    if (pageResponse.ok) {
        const html = await pageResponse.text();
        const extractedTranscript = extractTranscriptFromHtml(html);
        if (extractedTranscript && extractedTranscript.trim().length > 0) {
            console.log(`Found transcript via HTML fallback for ${videoId}`);
            return NextResponse.json({ captions: extractedTranscript.trim() });
        }
    } else {
        console.warn(`Failed to fetch video page for HTML fallback: ${videoUrl}, status: ${pageResponse.status}`);
    }

    console.log(`No captions found for ${videoId} after all attempts.`);
    return NextResponse.json({ error: "No captions found or available for this video." }, { status: 404 });

  } catch (error) {
    console.error(`Error getting YouTube captions for videoId ${originalVideoIdParam}:`, error);
    return NextResponse.json({
        error: "Failed to get YouTube captions",
        details: error instanceof Error ? error.message : "Unknown error",
        videoId: originalVideoIdParam
    }, { status: 500 });
  }
}
