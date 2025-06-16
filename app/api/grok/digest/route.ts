import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { timeframe, content, userId } = await request.json()

    if (!content || content.length === 0) {
      return NextResponse.json({ error: "No content provided for digest" }, { status: 400 })
    }

    // Prepare content summary for Grok
    const contentSummary = content
      .map(
        (item: any, index: number) => `
${index + 1}. **${item.title}** (${item.priority})
   Source: ${item.source}
   URL: ${item.url}
   Summary: ${item.summary}
   Tags: ${item.tags.join(", ")}
`,
      )
      .join("\n")

    const prompt = `Create a comprehensive weekly digest for a user's learning content. 

Here's what they consumed this week:

${contentSummary}

Please create a well-structured digest that includes:

1. **Executive Summary** - Key themes and insights from this week
2. **Priority Content** - Highlight the most important items they should focus on
3. **Key Concepts** - Main concepts and ideas discovered
4. **Connections** - How different pieces of content relate to each other
5. **Action Items** - Suggested next steps or follow-up reading
6. **Weekly Stats** - Brief statistics about their learning

Make it engaging, insightful, and actionable. Format it in clean HTML for email delivery.

The user is User ${userId?.replace("user_", "") || "Unknown"}.`

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that creates personalized learning digests. Create engaging, well-formatted HTML content for email delivery.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "grok-beta",
        stream: false,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Grok API error:", response.status, errorText)
      throw new Error(`Grok API error: ${response.status}`)
    }

    const data = await response.json()
    const digestContent = data.choices[0]?.message?.content

    if (!digestContent) {
      throw new Error("No digest content generated")
    }

    return NextResponse.json({
      success: true,
      content: digestContent,
      timeframe,
      itemCount: content.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Digest generation error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate digest",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
