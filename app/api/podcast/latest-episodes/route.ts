import { type NextRequest, NextResponse } from "next/server";
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const RSS_PARSER_TIMEOUT = 10000; // 10 seconds timeout for fetching RSS feed

interface Episode {
  id: string;
  title: string;
  url?: string; // Link to the episode page or audio file
  publishedAt: string;
  description?: string;
  audioUrl?: string;
  showTitle?: string;
  imageUrl?: string;
}

// Helper to fetch and parse RSS feed
async function fetchAndParseRssFeed(feedUrl: string, lastChecked: Date, showTitle?: string, showImageUrl?: string): Promise<Episode[]> {
  const parser = new Parser({ timeout: RSS_PARSER_TIMEOUT });
  try {
    const feed = await parser.parseURL(feedUrl);
    const episodes: Episode[] = [];

    if (!feed.items) return [];

    for (const item of feed.items.slice(0, 20)) { // Process more items initially
      const pubDate = item.pubDate || item.isoDate;
      if (!pubDate || new Date(pubDate) <= lastChecked) {
        continue; // Skip if no date or not newer than lastChecked
      }

      episodes.push({
        id: item.guid || item.link || pubDate || Math.random().toString(),
        title: item.title?.trim() || "Unknown Episode",
        url: item.link,
        publishedAt: new Date(pubDate).toISOString(),
        description: item.contentSnippet || item.itunes?.summary || item.summary || item.content,
        audioUrl: item.enclosure?.url || item.itunes?.episodeType === 'full' ? item.link : undefined,
        showTitle: feed.title || showTitle,
        imageUrl: item.itunes?.image || feed.image?.url || feed.itunes?.image || showImageUrl,
      });
    }
    return episodes.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0,10); // Return latest 10 new
  } catch (error) {
    console.error(`Error fetching or parsing RSS feed ${feedUrl}:`, error);
    throw new Error(`Failed to process RSS feed: ${feedUrl}`);
  }
}

// Helper to discover RSS feed from HTML content
async function discoverRssFeed(pageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(pageUrl, { headers: { 'User-Agent': 'PensiveApp/1.0 FeedDiscoverer' }});
    if (!response.ok) {
      console.warn(`Failed to fetch page ${pageUrl} for RSS discovery: ${response.status}`);
      return null;
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // Method 1: Standard RSS link tag
    let feedUrl = $('link[type="application/rss+xml"]').attr('href');
    if (feedUrl) return new URL(feedUrl, pageUrl).toString();

    // Method 2: Standard Atom link tag
    feedUrl = $('link[type="application/atom+xml"]').attr('href');
    if (feedUrl) return new URL(feedUrl, pageUrl).toString();

    // Method 3: JSON-LD for PodcastSeries
    const jsonLdData = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdData.length; i++) {
        try {
            const jsonContent = JSON.parse($(jsonLdData[i]).html() || '{}');
            // Handle cases where content might be an array or an object
            const items = Array.isArray(jsonContent) ? jsonContent : [jsonContent];
            for (const item of items) {
                if (item["@type"] === "PodcastSeries" && item.webFeed) {
                    return new URL(item.webFeed, pageUrl).toString();
                }
                 // Check for associatedMedia which might be a DataFeed
                if (item.associatedMedia && item.associatedMedia["@type"] === "DataFeed" && item.associatedMedia.encodingFormat === "application/rss+xml") {
                    return new URL(item.associatedMedia.contentUrl || item.associatedMedia.url, pageUrl).toString();
                }
            }
        } catch (e) {
            // console.debug("Could not parse JSON-LD content:", e);
        }
    }

    // Method 4: Look for common patterns (more heuristic)
    // Example: Spotify often embeds data in a script tag with id="initial-state" or similar
    // This part is highly specific and fragile, use with caution or expand significantly.
    // For Spotify, show pages might have a script tag with __NEXT_DATA__ containing show info
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if(pageUrl.includes("spotify.com") && nextDataScript) {
        try {
            const nextData = JSON.parse(nextDataScript);
            // Path to feed URL in Spotify's __NEXT_DATA__ can change. This is an example.
            // Need to inspect actual Spotify page structure for a reliable path.
            // This is a placeholder for a more complex extraction if needed.
            // console.log("Found __NEXT_DATA__ on Spotify, needs specific parsing logic.");
        } catch (e) {
            // console.debug("Could not parse __NEXT_DATA__ for Spotify:", e);
        }
    }


    return null;
  } catch (error) {
    console.error(`Error discovering RSS feed for ${pageUrl}:`, error);
    return null;
  }
}

async function getSpotifyEpisodes(url: string, lastChecked: Date): Promise<NextResponse> {
  const feedUrl = await discoverRssFeed(url);
  if (feedUrl) {
    try {
      const episodes = await fetchAndParseRssFeed(feedUrl, lastChecked, "Spotify Show"); // Placeholder title
      return NextResponse.json(episodes);
    } catch (rssError) {
      console.warn(`Failed to get episodes from discovered RSS feed (${feedUrl}) for Spotify URL ${url}. Error: ${rssError}. Falling back to scraping.`);
    }
  }

  // Fallback: Simplified scraping (original logic, but should be improved or removed if RSS is reliable)
  console.log(`Falling back to HTML scraping for Spotify URL: ${url}`);
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const episodes: Episode[] = [];

    // This is a very basic scraper and likely to break. Spotify's structure is complex.
    // A more robust scraper would target specific elements and attributes.
    // Example: $('a[href*="/episode/"]').each((i, el) => { ... });
    // For now, using the original regex-like approach as a placeholder for the fallback.
    const episodeMatches = html.match(/\/episode\/[a-zA-Z0-9]+/g) || [];
    for (const match of episodeMatches.slice(0, 5)) {
        const pubDate = new Date(Date.now() - episodes.length * 24 * 60 * 60 * 1000).toISOString(); // Mock date
        if (new Date(pubDate) > lastChecked) {
            episodes.push({
                id: match.replace("/episode/", ""),
                title: `Spotify Episode ${episodes.length + 1}`, // Mock title
                url: `https://open.spotify.com${match}`,
                publishedAt: pubDate,
                description: "Description from Spotify page (scraping needed)",
            });
        }
    }
    return NextResponse.json(episodes);
  } catch (error) {
    console.error("Error scraping Spotify episodes:", error);
    return NextResponse.json([]);
  }
}

async function getAppleEpisodes(url: string, lastChecked: Date): Promise<NextResponse> {
  // Attempt 1: Discover RSS via HTML parsing
  let feedUrl = await discoverRssFeed(url);

  // Attempt 2: iTunes Lookup API if HTML discovery fails
  if (!feedUrl) {
    console.log(`RSS not found in HTML for Apple URL ${url}, trying iTunes Lookup API.`);
    const podcastIdMatch = url.match(/\/id(\d+)/);
    if (podcastIdMatch && podcastIdMatch[1]) {
      const podcastId = podcastIdMatch[1];
      try {
        const lookupUrl = `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`;
        const response = await fetch(lookupUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0 && data.results[0].feedUrl) {
            feedUrl = data.results[0].feedUrl;
            console.log(`Found feed URL via iTunes Lookup API: ${feedUrl}`);
          }
        }
      } catch (e) {
        console.warn(`Error using iTunes Lookup API for ${url}:`, e);
      }
    }
  }

  if (feedUrl) {
    try {
      const episodes = await fetchAndParseRssFeed(feedUrl, lastChecked, "Apple Podcast Show"); // Placeholder
      return NextResponse.json(episodes);
    } catch (rssError) {
       console.warn(`Failed to get episodes from discovered RSS feed (${feedUrl}) for Apple URL ${url}. Error: ${rssError}. Falling back to scraping (if implemented).`);
    }
  }

  // Fallback: Scraping (currently placeholder, would need specific Apple Podcasts DOM parsing)
  console.log(`Falling back to HTML scraping for Apple URL (currently placeholder): ${url}`);
  // const response = await fetch(url);
  // const html = await response.text();
  // const $ = cheerio.load(html);
  // Logic to find episode elements and extract data...
  return NextResponse.json([]);
}


// YouTube scraping remains as is, as RSS discovery for channels is less standard via page.
async function getYouTubeEpisodes(url: string, lastChecked: Date): Promise<NextResponse> {
  console.log(`Fetching YouTube episodes (scraping) for: ${url}`);
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html); // Use cheerio for more robust parsing if needed

    // A more robust way with Cheerio (example, needs specific selectors for YouTube)
    // const episodes: Episode[] = [];
    // $('selector-for-video-item').each((i, el) => { ... });
    // For now, keeping the regex as it was in the original, but it's fragile.

    const videoMatches = html.match(/watch\?v=([a-zA-Z0-9_-]+)/g) || [];
    const episodes: Episode[] = [];

    for (const match of videoMatches.slice(0, 10)) {
      const videoId = match.replace("watch?v=", "");
      // Mocking publishedAt for YouTube as it's hard to get from general page scrape
      const publishedAt = new Date(Date.now() - episodes.length * 24 * 60 * 60 * 1000).toISOString();

      if (new Date(publishedAt) > lastChecked) {
        episodes.push({
          id: videoId,
          title: `YouTube Video ${episodes.length + 1}`, // Placeholder, real title needs specific scraping
          url: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt,
          description: "YouTube video description (scraping needed)",
        });
      }
    }
    return NextResponse.json(episodes);
  } catch (error) {
    console.error("Error getting YouTube episodes:", error);
    return NextResponse.json([]);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const lastCheckedParam = searchParams.get("lastChecked");

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    // Default to fetching episodes from the last 7 days if lastChecked is not provided or invalid
    let lastCheckedDate;
    if (lastCheckedParam && !isNaN(new Date(lastCheckedParam).getTime())) {
        lastCheckedDate = new Date(lastCheckedParam);
    } else {
        lastCheckedDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    console.log(`Fetching episodes for URL: ${url}, newer than: ${lastCheckedDate.toISOString()}`);

    if (url.includes("spotify.com/show")) {
      return await getSpotifyEpisodes(url, lastCheckedDate);
    } else if (url.includes("podcasts.apple.com")) {
      return await getAppleEpisodes(url, lastCheckedDate);
    } else if (url.includes("youtube.com/channel/") || url.includes("youtube.com/c/") || url.includes("youtube.com/@")) {
      return await getYouTubeEpisodes(url, lastCheckedDate);
    } else {
      // Assume it's a direct RSS feed URL if no platform matches
      console.log(`Attempting direct RSS fetch for URL: ${url}`);
      try {
        const episodes = await fetchAndParseRssFeed(url, lastCheckedDate);
        return NextResponse.json(episodes);
      } catch (error) {
         console.error(`Direct RSS fetch failed for ${url}:`, error);
         return NextResponse.json({ error: `Failed to process direct RSS feed: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
      }
    }
  } catch (error) {
    console.error("Error in GET latest episodes handler:", error);
    return NextResponse.json({ error: "Failed to get latest episodes" }, { status: 500 });
  }
}
