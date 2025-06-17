import type { NextRequest } from "next/server"
import { createAuthenticatedHandler } from "@/lib/auth/auth-utils"
import { contentService } from "@/lib/services/content-service"
import { cacheService } from "@/lib/cache/redis"
import crypto from "crypto"
import * as cheerio from "cheerio"

export const POST = createAuthenticatedHandler(async (request: NextRequest, user) => {
  try {
    const { url } = await request.json()

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Generate content hash for caching
    const contentHash = crypto.createHash("sha256").update(url).digest("hex")
    const cacheKey = cacheService.keys.grokAnalysis(contentHash)

    // Check cache first
    const cachedAnalysis = await cacheService.getJSON(cacheKey)
    if (cachedAnalysis) {
      console.log("Returning cached analysis for:", url)
      return new Response(JSON.stringify({ analysis: cachedAnalysis, cached: true }), {
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

    // Store content
    const { contentId, isNew } = await contentService.storeContent(user.id, {
      title,
      url,
      content,
      source: "web",
    })

    // Analyze with Grok if new content
    let analysis
    if (isNew) {
      analysis = await analyzeWithGrok(title, content, url)

      // Store analysis
      await contentService.storeAnalysis(user.id, {
        contentId,
        summary: analysis.summary,
        entities: analysis.entities,
        tags: analysis.tags,
        priority: analysis.priority,
        fullContent: analysis.fullContent,
        confidence: analysis.confidence,
      })

      // Cache the analysis for 24 hours
      await cacheService.set(cacheKey, analysis, 86400)
    } else {
      // Get existing analysis
      const existingContent = await contentService.getUserContent(user.id, { limit: 1 })
      analysis = existingContent.items.find((item) => item.id === contentId)?.analysis
    }

    return new Response(
      JSON.stringify({
        contentId,
        analysis,
        isNew,
        cached: !isNew,
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
})

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
        { name: "Technology", type: "CONCEPT" },
        { name: "Innovation", type: "CONCEPT" },
      ],
      tags: ["technology", "analysis"],
      priority: "READ" as const,
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
              "entities": [{"name": "Entity Name", "type": "CONCEPT|PERSON|ORGANIZATION|TECHNOLOGY|METHODOLOGY"}],
              "tags": ["tag1", "tag2", "tag3"],
              "priority": "SKIM|READ|DEEP_DIVE",
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
      entities: [{ name: "Content", type: "CONCEPT" }],
      tags: ["analyzed", "fallback"],
      priority: "READ" as const,
      confidence: 0.5,
    }
  }
}
