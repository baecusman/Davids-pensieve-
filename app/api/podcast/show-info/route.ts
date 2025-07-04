import { type NextRequest, NextResponse } from "next/server";
import * as cheerio from 'cheerio';

// Helper to absolutize URLs
function absolutizeUrl(relativeOrAbsoluteUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsoluteUrl, baseUrl).toString();
  } catch (e) {
    return relativeOrAbsoluteUrl; // Return original if it's already absolute or invalid
  }
}

async function discoverFeedInHtml(html: string, pageUrl: string): Promise<string | null> {
  const $ = cheerio.load(html);

  // 1. Standard RSS link tag
  let feedUrl = $('link[type="application/rss+xml"]').attr('href');
  if (feedUrl) return absolutizeUrl(feedUrl, pageUrl);

  // 2. Standard Atom link tag
  feedUrl = $('link[type="application/atom+xml"]').attr('href');
  if (feedUrl) return absolutizeUrl(feedUrl, pageUrl);

  // 3. JSON-LD for PodcastSeries
  const jsonLdScripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const scriptContent = $(jsonLdScripts[i]).html();
      if (!scriptContent) continue;

      const jsonContent = JSON.parse(scriptContent);
      const items = Array.isArray(jsonContent) ? jsonContent : [jsonContent];
      for (const item of items) {
        if (item["@type"] === "PodcastSeries" && item.webFeed) {
          return absolutizeUrl(item.webFeed, pageUrl);
        }
        if (item.associatedMedia && item.associatedMedia["@type"] === "DataFeed" &&
            (item.associatedMedia.encodingFormat === "application/rss+xml" || item.associatedMedia.encodingFormat === "application/atom+xml")) {
          if (item.associatedMedia.contentUrl || item.associatedMedia.url) {
            return absolutizeUrl(item.associatedMedia.contentUrl || item.associatedMedia.url, pageUrl);
          }
        }
      }
    } catch (e) {
      // console.debug("Could not parse JSON-LD content in discoverFeedInHtml:", e);
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageUrl = searchParams.get("url");

    if (!pageUrl) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PensiveBot/1.0; +http://pensive.app/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
    });

    if (!response.ok) {
      // Log more details for failing fetches
      console.error(`Failed to fetch ${pageUrl}: ${response.status} ${response.statusText}`);
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch(e) { /* ignore */}
      // console.error(`Response body: ${errorBody.substring(0, 500)}`);
      throw new Error(`HTTP error ${response.status} while fetching ${pageUrl}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      "Unknown Show";

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      "";

    const imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="twitter:image"]').attr('content') ||
      $('link[rel="apple-touch-icon"]').attr('href') || // Common for favicons that might be show art
      $('link[rel="icon"]').attr('href') || // General favicons
      null;


    let rssUrl = await discoverFeedInHtml(html, pageUrl);

    // Apple Podcasts specific fallback using iTunes Lookup API
    if (!rssUrl && pageUrl.includes("podcasts.apple.com")) {
      const podcastIdMatch = pageUrl.match(/\/id(\d+)/);
      if (podcastIdMatch && podcastIdMatch[1]) {
        const podcastId = podcastIdMatch[1];
        try {
          const lookupUrl = `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`;
          const lookupResponse = await fetch(lookupUrl);
          if (lookupResponse.ok) {
            const data = await lookupResponse.json();
            if (data.results && data.results.length > 0 && data.results[0].feedUrl) {
              rssUrl = data.results[0].feedUrl;
              console.log(`Found feed URL for Apple Podcast via iTunes Lookup API: ${rssUrl}`);
            }
          }
        } catch (e) {
          console.warn(`Error using iTunes Lookup API for ${pageUrl}:`, e);
        }
      }
    }

    // Fallback for Spotify if specific regex was useful (less reliable)
    // if (pageUrl.includes("spotify.com") && !rssUrl) {
    //   const rssMatch = html.match(/<link rel="alternate" type="application\/rss\+xml" href="([^"]+)"/i);
    //   if (rssMatch && rssMatch[1]) {
    //     rssUrl = absolutizeUrl(rssMatch[1], pageUrl);
    //   }
    // }


    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      rssUrl: rssUrl ? absolutizeUrl(rssUrl, pageUrl) : null, // Ensure rssUrl is absolute
      imageUrl: imageUrl ? absolutizeUrl(imageUrl, pageUrl) : null, // Ensure imageUrl is absolute
      originalUrl: pageUrl,
    });

  } catch (error) {
    console.error("Error extracting show info for URL:", searchParams.get("url"), error);
    return NextResponse.json(
      {
        title: "Unknown Show",
        description: "Could not extract show information due to an error.",
        rssUrl: null,
        imageUrl: null,
        originalUrl: searchParams.get("url"),
        error: error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 },
    );
  }
}
