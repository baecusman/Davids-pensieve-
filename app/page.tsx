// This is now a Server Component by default (no "use client")

import AppClientShell from "./AppClientShell";
import { ContentProcessor } from "@/lib/content-processor";
// TODO: Ensure databaseService and its dependencies are server-compatible if used directly here.
// For ContentProcessor, if it uses databaseService which uses Supabase client,
// that client needs to be configurable for server-side (e.g. using service key or passed auth).
// For this step, we assume ContentProcessor can be called server-side.

// Define interfaces for the data to be passed, matching AppClientShell expectations
interface InitialDigestArticle {
  id: string;
  title: string;
  url?: string;
  createdAt: string;
  analysis?: {
    summary?: { sentence: string };
    tags?: string[];
    priority?: string;
  };
}

interface InitialAIDigest {
  timeframe: string;
  generatedAt: string;
  summary: string;
  trendingConcepts: Array<{ name: string; reason: string; importance: string; trendType: string }>;
  items: Array<any>;
  stats: {
    totalArticles: number;
    deepDiveCount: number;
    readCount: number;
    skimCount: number;
  };
}


export default async function Home() {
  // Fetch initial data for the default view ("digests", period "weekly")
  let initialDigestArticles: InitialDigestArticle[] = [];
  let initialAIDigest: InitialAIDigest | null = null;
  const defaultTimeframe = 'weekly'; // Corresponds to 'week' period for DigestPeriodSection

  try {
    const articlesResult = await ContentProcessor.getStoredContent({
      limit: 10, // For preview
      timeframe: defaultTimeframe,
    });
    initialDigestArticles = Array.isArray(articlesResult) ? articlesResult : (articlesResult.items || []);

    if (initialDigestArticles.length > 0) {
        const digestItemsInput = initialDigestArticles.map((article: any) => ({
            title: article.title,
            summary: article.analysis?.summary?.sentence || article.summary || "No summary available",
            fullSummary: article.analysis?.summary?.paragraph || article.fullSummary || "",
            summaryType: article.analysis?.summary?.isFullRead ? ("full-read" as const) : ("paragraph" as const),
            priority: article.analysis?.priority || article.priority || "read",
            url: article.url,
            conceptTags: article.analysis?.tags || article.conceptTags || [],
            analyzedAt: article.createdAt || article.analyzedAt || new Date().toISOString(),
            fullContent: article.analysis?.fullContent || article.fullContent || "",
            source: article.source || "analyzed",
      }));
      initialAIDigest = await ContentProcessor.generateDigest(defaultTimeframe, digestItemsInput);
    } else {
      // Attempt to generate an empty/default digest if no articles
      initialAIDigest = await ContentProcessor.generateDigest(defaultTimeframe, []);
    }

  } catch (error) {
    console.error("Error fetching initial data in Home (Server Component):", error);
    // initialDigestArticles will remain empty, initialAIDigest will be null
    // The client components (DigestsView, DigestPeriodSection) will handle their own error display for this data.
  }

  return (
    <AppClientShell
      initialDigestArticles={initialDigestArticles}
      initialAIDigest={initialAIDigest}
    />
  );
}
