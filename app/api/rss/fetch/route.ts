import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    console.log(`Mock RSS fetch for: ${url}`)

    // Generate mock RSS data based on the URL
    const mockRSSData = generateMockRSSData(url)

    return NextResponse.json(mockRSSData)
  } catch (error) {
    console.error("Error in RSS fetch:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "RSS fetch failed" }, { status: 500 })
  }
}

function generateMockRSSData(url: string) {
  const hostname = new URL(url).hostname.toLowerCase()
  const now = new Date()

  let feedTitle = "RSS Feed"
  let items: any[] = []

  if (hostname.includes("kellblog") || hostname.includes("kell")) {
    feedTitle = "Kellblog - Enterprise Software & SaaS Analysis"
    items = [
      {
        title: "The Future of Enterprise SaaS: Multi-Tenant vs Single-Tenant Architecture",
        link: "https://kellblog.com/2024/06/enterprise-saas-architecture-trends",
        description:
          "Deep dive into architectural decisions for enterprise SaaS platforms, comparing multi-tenant and single-tenant approaches for scalability and security.",
        pubDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "Customer Success Metrics That Actually Matter in B2B SaaS",
        link: "https://kellblog.com/2024/06/customer-success-metrics-b2b",
        description:
          "Analysis of key customer success metrics beyond NPS, including product adoption scores, time-to-value, and expansion revenue indicators.",
        pubDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "The Rise of Vertical SaaS: Why Niche Markets Are Winning",
        link: "https://kellblog.com/2024/06/vertical-saas-market-trends",
        description:
          "Exploring how vertical SaaS solutions are outperforming horizontal platforms by solving specific industry problems with deeper domain expertise.",
        pubDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "API-First Strategy: Building the Modern Enterprise Stack",
        link: "https://kellblog.com/2024/05/api-first-enterprise-strategy",
        description:
          "How API-first architecture is enabling composable enterprise software stacks and accelerating digital transformation initiatives.",
        pubDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "Security-First SaaS: Zero Trust Architecture in Practice",
        link: "https://kellblog.com/2024/05/zero-trust-saas-security",
        description:
          "Implementing zero trust security principles in SaaS applications, from identity management to data encryption and network segmentation.",
        pubDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
  } else if (hostname.includes("stratechery")) {
    feedTitle = "Stratechery - Technology Business Strategy"
    items = [
      {
        title: "The AI Platform Wars: OpenAI vs Google vs Microsoft",
        link: "https://stratechery.com/2024/ai-platform-competition",
        description:
          "Strategic analysis of the competitive dynamics in AI platforms, examining moats, distribution advantages, and long-term positioning.",
        pubDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "Subscription Fatigue and the Future of SaaS Pricing",
        link: "https://stratechery.com/2024/subscription-fatigue-saas-pricing",
        description:
          "How subscription fatigue is forcing SaaS companies to rethink pricing models, from usage-based to value-based pricing strategies.",
        pubDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "The Aggregation Theory in the Age of AI",
        link: "https://stratechery.com/2024/aggregation-theory-ai-era",
        description:
          "Revisiting aggregation theory in the context of AI-powered platforms and how machine learning changes competitive dynamics.",
        pubDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "Platform Regulation: The European Digital Markets Act Impact",
        link: "https://stratechery.com/2024/dma-platform-regulation-impact",
        description:
          "Analysis of how the Digital Markets Act is reshaping platform business models and creating new opportunities for competitors.",
        pubDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
  } else {
    // Generic RSS feed
    feedTitle = "Business & Technology Insights"
    items = [
      {
        title: "Digital Transformation Trends for 2024",
        link: `${url}/digital-transformation-2024`,
        description:
          "Key trends shaping digital transformation initiatives across industries, from AI adoption to cloud-native architectures.",
        pubDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "The Future of Remote Work Technology",
        link: `${url}/remote-work-technology`,
        description:
          "How technology is evolving to support distributed teams, from collaboration tools to virtual reality workspaces.",
        pubDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: "Sustainable Technology: Green Computing Initiatives",
        link: `${url}/sustainable-technology-green-computing`,
        description:
          "Exploring how technology companies are reducing their environmental impact through green computing and sustainable practices.",
        pubDate: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
  }

  return {
    title: feedTitle,
    description: `${feedTitle} - Latest articles and insights`,
    items,
    lastBuildDate: now.toISOString(),
    generator: "Mock RSS Generator",
  }
}
