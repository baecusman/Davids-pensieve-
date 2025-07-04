import { generateText } from "ai";
import { xai } from "@ai-sdk/xai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from 'zod';

// Zod schema for individual DigestItem
const digestItemSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  summary: z.string().min(1, "Summary cannot be empty"),
  fullSummary: z.string().optional(),
  summaryType: z.enum(["sentence", "paragraph", "full-read"]),
  priority: z.enum(["skim", "read", "deep-dive"]),
  url: z.string().url("Invalid URL format"),
  conceptTags: z.array(z.string()),
  analyzedAt: z.string().datetime("Invalid date format for analyzedAt"), // or z.date() if you parse it first
  source: z.string().optional(),
});

// Zod schema for the request body
const generateDigestSchema = z.object({
  timeframe: z.enum(["weekly", "monthly", "quarterly"]),
  articles: z.array(digestItemSchema).min(1, "At least one article is required for digest generation"),
});

interface DigestItem extends z.infer<typeof digestItemSchema> {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = generateDigestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { timeframe, articles } = validationResult.data;

    // The old check for articles.length === 0 is now covered by Zod's .min(1)

    // Separate analyzed vs historical content
    const analyzedArticles = articles.filter((a: DigestItem) => a.source === "analyzed")
    const historicalArticles = articles.filter((a: DigestItem) => a.source === "historical")

    // Prepare article summaries for Grok analysis
    const articleSummaries = articles.map((article: DigestItem) => ({
      title: article.title,
      summary: article.summary,
      priority: article.priority,
      tags: article.conceptTags,
      date: article.analyzedAt,
      source: article.source || "unknown",
    }))

    // Generate comprehensive digest summary using Grok
    const digestSummary = await generateText({
      model: xai("grok-2-1212"),
      prompt: `
        Create a comprehensive ${timeframe} digest summary for "Pensive", a curated intelligence system.
        
        You have ${articles.length} articles to analyze:
        - ${analyzedArticles.length} recently analyzed articles (real-time intelligence)
        - ${historicalArticles.length} historical articles (contextual background)
        
        Create a cohesive narrative that:
        1. Synthesizes key themes and emerging trends
        2. Highlights the most strategic developments
        3. Connects recent developments with historical context
        4. Provides actionable insights for decision-makers
        5. Identifies patterns across different time periods
        
        Articles to analyze:
        ${articleSummaries
          .map(
            (article, index) => `
        ${index + 1}. [${article.source?.toUpperCase()}] ${article.title}
           Summary: ${article.summary}
           Priority: ${article.priority}
           Tags: ${article.tags.join(", ")}
        `,
          )
          .join("\n")}
        
        Write a comprehensive ${timeframe} executive summary (3-4 paragraphs) that:
        - Opens with the most critical developments
        - Weaves together recent analysis with historical trends
        - Provides strategic context and implications
        - Concludes with forward-looking insights
        
        Focus on what senior decision-makers need to know to stay ahead of the curve.
      `,
    })

    // Identify trending concepts with enhanced analysis
    const conceptAnalysis = await generateText({
      model: xai("grok-2-1212"),
      prompt: `
        Analyze these ${articles.length} articles (${analyzedArticles.length} recent + ${historicalArticles.length} historical) to identify the top 5 trending concepts:
        
        ${articleSummaries.map((article) => `- [${article.source?.toUpperCase()}] ${article.title}: ${article.tags.join(", ")}`).join("\n")}
        
        For each trending concept, provide:
        1. The concept name
        2. Why it's trending (considering both recent and historical context)
        3. Its strategic importance and potential impact
        4. Whether it's an emerging trend or accelerating established pattern
        
        Format as a JSON array with objects containing: name, reason, importance, trendType
        
        Focus on concepts that show momentum across both recent analysis and historical patterns.
      `,
    })

    let trendingConcepts = []
    try {
      trendingConcepts = JSON.parse(conceptAnalysis.text)
    } catch {
      // Enhanced fallback with source awareness
      trendingConcepts = [
        {
          name: "AI-Powered Development",
          reason: "Accelerating adoption across analyzed and historical content",
          importance: "Fundamental shift in how software is built",
          trendType: "accelerating",
        },
        {
          name: "Edge Computing",
          reason: "Consistent growth pattern with recent breakthrough applications",
          importance: "Critical for next-generation applications",
          trendType: "established",
        },
        {
          name: "Sustainable Technology",
          reason: "Emerging theme in recent analysis",
          importance: "Growing regulatory and business imperative",
          trendType: "emerging",
        },
      ]
    }

    // Enhanced sorting with source awareness
    const sortedArticles = articles.sort((a: DigestItem, b: DigestItem) => {
      // Prioritize analyzed content over historical
      if (a.source === "analyzed" && b.source !== "analyzed") return -1
      if (b.source === "analyzed" && a.source !== "analyzed") return 1

      // Then sort by priority
      const priorityOrder = { "deep-dive": 0, read: 1, skim: 2 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff

      // Finally by date (most recent first)
      return new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
    })

    const digest = {
      timeframe,
      generatedAt: new Date().toISOString(),
      summary: digestSummary.text,
      trendingConcepts,
      items: sortedArticles,
      stats: {
        totalArticles: articles.length,
        analyzedArticles: analyzedArticles.length,
        historicalArticles: historicalArticles.length,
        deepDiveCount: articles.filter((a: DigestItem) => a.priority === "deep-dive").length,
        readCount: articles.filter((a: DigestItem) => a.priority === "read").length,
        skimCount: articles.filter((a: DigestItem) => a.priority === "skim").length,
      },
    }

    return NextResponse.json(digest)
  } catch (error) {
    console.error("Error generating digest:", error)

    // Enhanced fallback digest
    const fallbackDigest = {
      timeframe: "weekly",
      generatedAt: new Date().toISOString(),
      summary:
        "This comprehensive digest combines recent intelligence analysis with historical context to provide strategic insights into technology and business developments. Key themes include the acceleration of AI adoption, the maturation of cloud-native architectures, and emerging sustainability considerations in technology decisions.",
      trendingConcepts: [
        {
          name: "AI Integration",
          reason: "Consistent growth across all content sources",
          importance: "Reshaping competitive landscapes",
          trendType: "accelerating",
        },
      ],
      items: [],
      stats: {
        totalArticles: 0,
        analyzedArticles: 0,
        historicalArticles: 0,
        deepDiveCount: 0,
        readCount: 0,
        skimCount: 0,
      },
    }

    return NextResponse.json(fallbackDigest)
  }
}
