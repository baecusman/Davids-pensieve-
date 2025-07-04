import { type NextRequest, NextResponse } from "next/server";
import Parser from 'rss-parser';

interface RSSItem {
  title: string;
  link?: string; // Link can be optional
  description?: string; // Description can be optional
  pubDate?: string; // Publication date can be optional
  guid: string; // GUID should ideally always be present or derived
  content?: string; // Full content if available
  isoDate?: string; // Standardized date
  enclosure?: {
    url?: string;
    type?: string;
    length?: string;
  };
  // Add other fields you might need from rss-parser's output
  creator?: string;
  categories?: string[];
}

interface RSSFeed {
  title?: string;
  description?: string;
  link?: string;
  items: RSSItem[];
  feedUrl?: string;
  image?: {
    link?: string;
    url?: string;
    title?: string;
  };
  // Add other feed-level fields
  language?: string;
  lastBuildDate?: string;
}

const RSS_PARSER_TIMEOUT = 10000; // 10 seconds timeout

export async function POST(request: NextRequest) {
  const urlParam = new URL(request.url).searchParams.get('url'); // For logging
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Fetching RSS feed: ${url}`);

    const parser = new Parser({
        timeout: RSS_PARSER_TIMEOUT,
        // Default headers can be overridden if needed, but User-Agent is good
        headers: {
            'User-Agent': 'Pensive RSS Reader/1.0',
            'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml',
        },
        // Custom fields can be mapped if needed, e.g. for namespaces
        // customFields: {
        //   feed: [],
        //   item: [],
        // }
    });

    const feedOutput = await parser.parseURL(url);

    const responseFeed: RSSFeed = {
      title: feedOutput.title,
      description: feedOutput.description,
      link: feedOutput.link,
      feedUrl: feedOutput.feedUrl || url,
      image: feedOutput.image,
      language: feedOutput.language,
      lastBuildDate: feedOutput.lastBuildDate,
      items: (feedOutput.items || []).map((item: Parser.Item): RSSItem => ({
        title: item.title || "Untitled",
        link: item.link,
        description: item.contentSnippet || item.summary || item.content, // Prefer contentSnippet, fallback
        pubDate: item.pubDate,
        isoDate: item.isoDate, // rss-parser provides this standardized date
        guid: item.guid || item.link || item.title || `item-${Date.now()}-${Math.random()}`, // Ensure GUID
        content: item.content, // Full content if available
        enclosure: item.enclosure,
        creator: item.creator || (item as any).author || (item as any)['dc:creator'], // Common author fields
        categories: Array.isArray(item.categories) ? item.categories.map(c => typeof c === 'string' ? c : c._) : undefined,
      })).sort((a, b) => { // Sort by date, newest first
        const dateA = a.isoDate ? new Date(a.isoDate) : (a.pubDate ? new Date(a.pubDate) : new Date(0));
        const dateB = b.isoDate ? new Date(b.isoDate) : (b.pubDate ? new Date(b.pubDate) : new Date(0));
        return dateB.getTime() - dateA.getTime();
      }).slice(0, 50), // Limit to 50 items, adjust as needed
    };

    console.log(`Successfully parsed RSS feed: ${responseFeed.title} (${responseFeed.items.length} items)`);

    return NextResponse.json(responseFeed);

  } catch (error) {
    console.error(`Error fetching RSS feed for URL ${urlParam}:`, error);
    let errorMessage = "Failed to fetch or parse RSS feed";
    if (error instanceof Error) {
        errorMessage = error.message.includes('timeout') ? 'Request to RSS feed timed out' : error.message;
    }
    return NextResponse.json({
        error: errorMessage,
        url: urlParam
    }, { status: 500 });
  }
}
