import type { NextRequest } from "next/server"
import { supabaseContentService } from "@/lib/services/supabase-content-service"
import * as cheerio from "cheerio"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Fetch and parse content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Pensive Content Analyzer/2.0",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract title and content using cheerio
    const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled"

    // Try to extract main content
    let content = ""
    const contentSelectors = [
      "article",
      '[role="main"]',
      ".content",
      ".post-content",
      ".entry-content",
      "main",
      ".article-body",
    ]

    for (const selector of contentSelectors) {
      const element = $(selector)
      if (element.length && element.text().trim().length > 100) {
        content = element.text().trim()
        break
      }
    }

    // Fallback to body if no main content found
    if (!content) {
      $("script, style, nav, header, footer, aside").remove()
      content = $("body").text().trim()
    }

    // Clean and limit content
    content = content.replace(/\s+/g, " ").trim().substring(0, 10000)

    if (!content) {
      throw new Error("No content could be extracted from the URL")
    }

    // Analyze with Grok
    const analysis = await analyzeWithGrok(title, content, url)

    // Store content and analysis
    const result = await supabaseContentService.storeAnalyzedContent({
      title,
      url,
      content,
      source: "web",
      analysis,
    })

    return new Response(
      JSON.stringify({
        contentId: result.contentId,
        analysis,
        isNew: result.isNew,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Content analysis error:", error)
    return new Response(JSON.stringify({ error: "Failed to analyze content" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

async function analyzeWithGrok(title: string, content: string, url: string) {
  const apiKey = process.env.XAI_API_KEY

  if (!apiKey) {
    // Return mock analysis if no API key
    return {
      summary: {
        sentence: `Analysis of "${title}"`,
        paragraph: `This content discusses various topics and provides insights into the subject matter.`,
        isFullRead: false,
      },
      entities: [
        { name: "Technology", type: "concept" },
        { name: "Innovation", type: "concept" },
      ],
      tags: ["technology", "analysis"],
      priority: "read" as const,
      confidence: 0.7,
    }
  }

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are an expert content analyzer. Analyze the given content and return a JSON response with the following structure:
            {
              "summary": {
                "sentence": "One sentence summary",
                "paragraph": "Detailed paragraph summary",
                "isFullRead": false
              },
              "entities": [{"name": "Entity Name", "type": "concept"}],
              "tags": ["tag1", "tag2", "tag3"],
              "priority": "skim|read|deep-dive",
              "confidence": 0.8
            }`,
          },
          {
            role: "user",
            content: `Title: ${title}\n\nContent: ${content}\n\nURL: ${url}`,
          },
        ],
        model: "grok-beta",
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`)
    }

    const data = await response.json()
    const analysisText = data.choices[0].message.content

    return JSON.parse(analysisText)
  } catch (error) {
    console.error("Grok analysis error:", error)

    // Return fallback analysis
    return {
      summary: {
        sentence: `Analysis of "${title}"`,
        paragraph: `This content has been processed with a fallback analyzer due to API limitations.`,
        isFullRead: false,
      },
      entities: [{ name: "Content", type: "concept" }],
      tags: ["analyzed", "fallback"],
      priority: "read" as const,
      confidence: 0.5,
    }
  }
}
