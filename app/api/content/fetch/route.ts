import { type NextRequest, NextResponse } from "next/server";
import * as cheerio from 'cheerio';
import { z } from 'zod';

// Define Zod schema for the request body
const fetchContentSchema = z.object({
  url: z.string().url({ message: "Invalid URL format" }).min(1, { message: "URL cannot be empty" }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = fetchContentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { url } = validationResult.data; // Use validated and typed data

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Pensive Content Analyzer/1.0 (compatible; PensiveBot/1.0; +http://pensive.app/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch content from ${url}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      "Untitled";

    // Attempt to extract main content, then fallback to body
    let mainContentElement = $('article').first();
    if (mainContentElement.length === 0) {
      mainContentElement = $('main').first();
    }
    if (mainContentElement.length === 0) {
      // Common class names for main content areas
      const commonSelectors = ['#content', '.content', '#main', '.main', '#article', '.article',
                               '.post-content', '.entry-content', '.post-body', '.article-body'];
      for (const selector of commonSelectors) {
        mainContentElement = $(selector).first();
        if (mainContentElement.length > 0) break;
      }
    }
     // If still no main content element, fallback to body
    if (mainContentElement.length === 0) {
        mainContentElement = $('body');
    }


    // Remove unwanted elements like scripts, styles, nav, footer, ads etc.
    mainContentElement.find('script, style, nav, footer, header, aside, form, noscript, iframe, [aria-hidden="true"]').remove();
    // Remove elements that are often visually hidden but might contain text
    mainContentElement.find('.sr-only, .visually-hidden, [style*="display:none"], [style*="visibility:hidden"]').remove();


    // Get text and clean it up
    let content = mainContentElement.text();

    // Fallback if text extraction yields very little (e.g. SPA heavily reliant on JS for content)
    if (content.trim().length < 200 && $('body').length) { // 200 is an arbitrary threshold
        const bodyText = $('body').text();
        if (bodyText.trim().length > content.trim().length) {
            // A very basic attempt to clean body text if main content is poor
            $('body script, body style, body nav, body footer, body header, body aside, body form, body noscript, body iframe').remove();
            content = $('body').text();
        }
    }

    content = content.replace(/\s\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();


    // Limit content length
    const maxLength = 25000; // Increased limit for potentially better analysis context
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + "...";
    }

    return NextResponse.json({
      title: title.trim(),
      content: content.trim(),
      url,
      fetchedAt: new Date().toISOString(),
    });

  } catch (error) {
    const urlParam = new URL(request.url).searchParams.get('url');
    console.error(`Error fetching content for URL ${urlParam}:`, error);
    return NextResponse.json({
        error: `Failed to fetch or process content from URL. ${error instanceof Error ? error.message : 'Unknown error'}`,
        url: urlParam
    }, { status: 500 });
  }
}
