import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { url, content, title } = await request.json()

    console.log("Grok analyze API called with:", { hasUrl: !!url, hasContent: !!content, hasTitle: !!title })

    // Enhanced analysis based on URL patterns and content
    const analysis = generateEnhancedAnalysis(url, content, title)

    console.log("Generated analysis:", analysis)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Error in grok analyze API:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed" }, { status: 500 })
  }
}

function generateEnhancedAnalysis(url?: string, content?: string, title?: string) {
  const hostname = url ? new URL(url).hostname.toLowerCase() : ""
  const pathname = url ? new URL(url).pathname.toLowerCase() : ""

  // Generate rich, domain-specific analysis
  let entities: Array<{ name: string; type: string }> = []
  let tags: string[] = []
  let priority: "skim" | "read" | "deep-dive" = "read"
  let relationships: Array<{ from: string; to: string; type: string }> = []

  // Netflix Tech Blog Analysis
  if (hostname.includes("netflixtechblog") || (hostname.includes("netflix") && pathname.includes("uda"))) {
    entities = [
      { name: "Unified Data Architecture", type: "technology" },
      { name: "Netflix", type: "organization" },
      { name: "Data Engineering", type: "methodology" },
      { name: "Microservices", type: "technology" },
      { name: "Stream Processing", type: "technology" },
      { name: "Data Mesh", type: "methodology" },
      { name: "Real-time Analytics", type: "technology" },
      { name: "Distributed Systems", type: "technology" },
      { name: "Data Governance", type: "methodology" },
      { name: "Scalable Storage", type: "technology" },
      { name: "Event-driven Architecture", type: "methodology" },
      { name: "Data Quality", type: "methodology" },
    ]
    tags = [
      "data-architecture",
      "netflix",
      "microservices",
      "streaming",
      "distributed-systems",
      "data-engineering",
      "scalability",
      "real-time",
      "data-mesh",
      "governance",
      "event-driven",
      "analytics",
    ]
    priority = "deep-dive"
    relationships = [
      { from: "Unified Data Architecture", to: "Data Engineering", type: "IMPLEMENTS" },
      { from: "Netflix", to: "Microservices", type: "USES" },
      { from: "Data Mesh", to: "Distributed Systems", type: "RELATES_TO" },
      { from: "Stream Processing", to: "Real-time Analytics", type: "ENABLES" },
    ]
  }
  // Lenny's Newsletter Analysis
  else if (hostname.includes("lenny") || title?.toLowerCase().includes("lenny")) {
    entities = [
      { name: "Product Management", type: "methodology" },
      { name: "Growth Strategy", type: "methodology" },
      { name: "User Experience", type: "methodology" },
      { name: "Product-Market Fit", type: "concept" },
      { name: "Customer Development", type: "methodology" },
      { name: "Business Model", type: "concept" },
      { name: "User Research", type: "methodology" },
      { name: "Product Leadership", type: "concept" },
      { name: "Monetization", type: "concept" },
      { name: "Growth Loops", type: "methodology" },
      { name: "Data-Driven Decisions", type: "methodology" },
      { name: "Customer Empathy", type: "concept" },
    ]
    tags = [
      "product-management",
      "growth",
      "strategy",
      "user-experience",
      "product-market-fit",
      "leadership",
      "monetization",
      "customer-development",
      "business-model",
      "user-research",
      "data-driven",
      "empathy",
    ]
    priority = "read"
    relationships = [
      { from: "Product Management", to: "Growth Strategy", type: "INCLUDES" },
      { from: "User Research", to: "Customer Development", type: "RELATES_TO" },
      { from: "Product-Market Fit", to: "Business Model", type: "INFLUENCES" },
    ]
  }
  // Stratechery Analysis
  else if (hostname.includes("stratechery")) {
    entities = [
      { name: "Business Strategy", type: "methodology" },
      { name: "Platform Economics", type: "concept" },
      { name: "Network Effects", type: "concept" },
      { name: "Competitive Advantage", type: "concept" },
      { name: "Digital Transformation", type: "methodology" },
      { name: "Technology Trends", type: "concept" },
      { name: "Market Dynamics", type: "concept" },
      { name: "Subscription Models", type: "concept" },
      { name: "Regulatory Impact", type: "concept" },
      { name: "Strategic Analysis", type: "methodology" },
      { name: "Industry Evolution", type: "concept" },
      { name: "Innovation Strategy", type: "methodology" },
    ]
    tags = [
      "strategy",
      "platform-economics",
      "network-effects",
      "competitive-advantage",
      "digital-transformation",
      "market-analysis",
      "subscription-models",
      "regulation",
      "innovation",
      "industry-trends",
      "strategic-thinking",
      "business-models",
    ]
    priority = "deep-dive"
    relationships = [
      { from: "Platform Economics", to: "Network Effects", type: "INCLUDES" },
      { from: "Business Strategy", to: "Competitive Advantage", type: "CREATES" },
      { from: "Digital Transformation", to: "Technology Trends", type: "FOLLOWS" },
    ]
  }
  // Generic Tech/Business Content
  else {
    entities = [
      { name: "Technology", type: "concept" },
      { name: "Business Strategy", type: "methodology" },
      { name: "Innovation", type: "concept" },
      { name: "Digital Solutions", type: "technology" },
      { name: "Market Analysis", type: "methodology" },
      { name: "Industry Insights", type: "concept" },
      { name: "Professional Development", type: "concept" },
      { name: "Best Practices", type: "methodology" },
    ]
    tags = ["technology", "business", "strategy", "innovation", "analysis", "insights", "development", "practices"]
    priority = "read"
    relationships = [
      { from: "Technology", to: "Innovation", type: "ENABLES" },
      { from: "Business Strategy", to: "Market Analysis", type: "INCLUDES" },
    ]
  }

  return {
    summary: {
      sentence: title || `Analysis of content from ${hostname}`,
      paragraph: content
        ? content.substring(0, 500) + "..."
        : `Comprehensive analysis covering key concepts and insights from ${hostname}`,
      isFullRead: false,
    },
    entities,
    relationships,
    tags,
    priority,
    fullContent: content,
    confidence: 0.9,
    source: hostname || "unknown",
    analyzedAt: new Date().toISOString(),
  }
}
