import { type NextRequest, NextResponse } from "next/server";
import { z } from 'zod';

// Define Zod schema for the search parameters
const extractParamsSchema = z.object({
  url: z.string().url({ message: "Invalid URL format" }).min(1, { message: "URL parameter is required" }),
});

export async function GET(request: NextRequest) {
  const urlParamForLogging = new URL(request.url).searchParams.get('url'); // For logging before parsing
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validationResult = extractParamsSchema.safeParse(params);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { url } = validationResult.data; // Use validated and typed data

    // Fetch the page content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PensiveBot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // Return the HTML content
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*", // Consider if this is appropriate or should be more restrictive
      },
    })
  } catch (error) {
    const urlParam = new URL(request.url).searchParams.get('url');
    console.error(`Error extracting page content for URL ${urlParam}:`, error);
    return NextResponse.json({
        error: "Failed to extract page content",
        details: error instanceof Error ? error.message : "Unknown error",
        url: urlParam
    }, { status: 500 });
  }
}
