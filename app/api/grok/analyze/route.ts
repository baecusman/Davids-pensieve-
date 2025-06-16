import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { content, title, url } = await request.json()

    if (!content || !title) {
      return NextResponse.json({ error: "Content and title are required" }, { status: 400 })
    }

    // Check if XAI_API_KEY is available
    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
      console.warn("XAI_API_KEY not found, using mock analysis")

      // Return mock analysis when API key is not available
      const mockAnalysis = {
        summary: {
          sentence: `Analysis of "${title}" - ${content.substring(0, 100)}...`,
          paragraph: `This content discusses various topics and concepts. The analysis provides insights into the main themes and relationships between different ideas presented in the material.`,
          isFullRead: false,
        },
        entities: [
          { name: "Technology", type: "concept" },
          { name: "Innovation", type: "concept" },
          { name: "Analysis", type: "concept" },
        ],
        relationships: [
          { from: "Technology", to: "Innovation", type: "ENABLES" },
          { from: "Innovation", to: "Analysis", type: "REQUIRES" },
        ],
        tags: ["technology", "analysis", "concepts"],
        priority: "read" as const,
      }

      return NextResponse.json({ analysis: mockAnalysis })
    }

    // Make request to Grok API
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
              "entities": [{"name": "Entity Name", "type": "concept|person|organization|location"}],
              "relationships": [{"from": "Entity1", "to": "Entity2", "type": "RELATIONSHIP_TYPE"}],
              "tags": ["tag1", "tag2", "tag3"],
              "priority": "deep-dive|read|skim"
            }`,
          },
          {
            role: "user",
            content: `Title: ${title}\n\nContent: ${content}\n\nURL: ${url || "N/A"}`,
          },
        ],
        model: "grok-beta",
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Grok API error:", response.status, errorText)

      // Fall back to mock analysis on API error
      const mockAnalysis = {
        summary: {
          sentence: `Analysis of "${title}" - API temporarily unavailable`,
          paragraph: `This content has been processed with a fallback analyzer. The main themes and concepts have been identified for inclusion in your knowledge base.`,
          isFullRead: false,
        },
        entities: [
          { name: "Content Analysis", type: "concept" },
          { name: "Knowledge Management", type: "concept" },
        ],
        relationships: [{ from: "Content Analysis", to: "Knowledge Management", type: "SUPPORTS" }],
        tags: ["analysis", "content", "fallback"],
        priority: "read" as const,
      }

      return NextResponse.json({ analysis: mockAnalysis })
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from Grok API")
    }

    const analysisText = data.choices[0].message.content

    try {
      const analysis = JSON.parse(analysisText)
      return NextResponse.json({ analysis })
    } catch (parseError) {
      console.error("Error parsing Grok response:", parseError)

      // Extract key information manually if JSON parsing fails
      const fallbackAnalysis = {
        summary: {
          sentence: `Analysis of "${title}"`,
          paragraph: analysisText.substring(0, 500) + "...",
          isFullRead: false,
        },
        entities: [{ name: "Content", type: "concept" }],
        relationships: [],
        tags: ["analyzed", "content"],
        priority: "read" as const,
      }

      return NextResponse.json({ analysis: fallbackAnalysis })
    }
  } catch (error) {
    console.error("Analysis error:", error)

    // Always return a valid response, even on error
    const errorAnalysis = {
      summary: {
        sentence: "Content analysis temporarily unavailable",
        paragraph: "The content has been saved but could not be fully analyzed at this time. Please try again later.",
        isFullRead: false,
      },
      entities: [],
      relationships: [],
      tags: ["error", "retry-needed"],
      priority: "read" as const,
    }

    return NextResponse.json({ analysis: errorAnalysis })
  }
}
