"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import DigestContentItem from "../digest-content-item"
import FullReadModal from "../full-read-modal"
import LoadingSkeleton from "../loading-skeleton"
import { ContentProcessor } from "@/lib/content-processor"
import { performanceMonitor } from "@/lib/performance-monitor"
import { cacheManager } from "@/lib/cache-manager"
import ErrorBoundary from "../error-boundary";
import DigestPeriodSection from "../digest/DigestPeriodSection";

// Define interfaces for the initial data passed from Server Component
// These should match the structure defined in AppClientShell and app/page.tsx
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

interface DigestsViewProps {
  initialPreviewArticles?: InitialDigestArticle[];
  initialAiDigest?: InitialAIDigest | null;
}

export default function DigestsView({ initialPreviewArticles, initialAiDigest }: DigestsViewProps) {
  const [activeDigestType, setActiveDigestType] = useState<"weekly" | "monthly" | "quarterly">("weekly");
  const [selectedFullRead, setSelectedFullRead] = useState<{
    title: string;
    content: string;
    url?: string;
  } | null>(null);
  // const [isGenerating, setIsGenerating] = useState(false); // Will be handled by DigestPeriodSection
  // const [generationStatus, setGenerationStatus] = useState(""); // Will be handled by DigestPeriodSection
  // const [generatedDigest, setGeneratedDigest] = useState<any>(null); // Will be handled by DigestPeriodSection
  const [realContentCount, setRealContentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // For the preview list
  const [storedContent, setStoredContent] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // This function now primarily loads content for the preview list.
  // DigestPeriodSection will handle its own data fetching for the AI digest.
  const loadContentData = useCallback(async (isInitialLoad = false) => {
    // If initial data is provided for the current activeDigestType, use it for the preview
    if (isInitialLoad && initialPreviewArticles &&
        (activeDigestType === 'weekly' || (initialPreviewArticles as any).timeframe === activeDigestType) // Basic check
    ) {
      setStoredContent(initialPreviewArticles);
      setRealContentCount(initialPreviewArticles.length);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const cacheKey = `digest-content-preview:${activeDigestType}`;
    const cached = cacheManager.get<{ content: any[]; count: number }>(cacheKey);

    if (cached) {
      setStoredContent(cached.content);
      setRealContentCount(cached.count);
      setIsLoading(false);
      return;
    }

    const timer = performanceMonitor.startTimer("preview-db-query");
    try {
      const resultItems = await ContentProcessor.getStoredContent({
        limit: 100, // Limit for preview
        timeframe: activeDigestType,
      });

      const content = Array.isArray(resultItems) ? resultItems : [];
      const count = content.length;

      setStoredContent(content);
      setRealContentCount(count);

      if (content.length > 0) {
        cacheManager.set(cacheKey, { content, count }, 5 * 60 * 1000); // 5 min cache for preview
      }
    } catch (err: any) {
      console.error("Error loading preview content data:", err);
      setError(`Failed to load preview content: ${err.message || "Unknown error"}`);
      setStoredContent([]);
      setRealContentCount(0);
    } finally {
      setIsLoading(false);
      timer();
    }
  }, [activeDigestType, initialPreviewArticles]);

  useEffect(() => {
    // Pass true for initial load to check for props
    const timeoutId = setTimeout(() => loadContentData(true), 100);
    return () => clearTimeout(timeoutId);
  }, [loadContentData]); // loadContentData itself depends on activeDigestType and initialPreviewArticles

  // When activeDigestType changes, reload preview content (will check cache/fetch)
  // This useEffect is separate from the initial load to handle tab switches.
  useEffect(() => {
    // Don't run on initial mount if initialPreviewArticles are handled by the first useEffect's loadContentData(true)
    // This effect is mainly for subsequent changes to activeDigestType
    if (!isLoading) { // Avoid fetching if initial load is still in progress or if initial props were just used.
        const timeoutId = setTimeout(() => loadContentData(false), 100); // Pass false, not initial load
        return () => clearTimeout(timeoutId);
    }
  }, [activeDigestType]); // Only re-run when activeDigestType changes, not loadContentData to avoid loop

  // Memoized event handlers
  const handleTagClick = useCallback((tag: string) => {
    console.log("Tag clicked:", tag)
    // TODO: Filter concept map or highlight related concepts
  }, [])

  const handleFullReadClick = useCallback((item: any) => {
    setSelectedFullRead({
      title: item.title,
      content: item.fullContent || item.content || "Full content would be loaded here...",
      url: item.url,
    })
  }, [])

  // Optimized digest generation - This is now handled by DigestPeriodSection
  // const handleGenerate = useCallback(async () => { ... }, [isGenerating, storedContent, activeDigestType])

  // Memoized content items for performance (for the preview list)
  const contentItems = useMemo(() => {
    return storedContent
      .slice(0, 10)
      .map((item, index) => (
        <DigestContentItem
          key={`${item.id}-${index}`}
          title={item.title}
          summary={item.analysis?.summary?.sentence || item.summary || "No summary available"}
          fullSummary={item.analysis?.summary?.paragraph || item.fullSummary}
          summaryType={item.analysis?.summary?.isFullRead ? "full-read" : "paragraph"}
          priority={item.analysis?.priority || item.priority || "read"}
          isNew={false}
          url={item.url}
          conceptTags={item.analysis?.tags || item.conceptTags || []}
          onTagClick={handleTagClick}
          onFullReadClick={() => handleFullReadClick(item)}
        />
      ))
  }, [storedContent, handleTagClick, handleFullReadClick])

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Placeholder for navigation/header part of the skeleton */}
        <LoadingSkeleton height={60} className="mb-8" />
        {/* Skeleton for content list */}
        <LoadingSkeleton height={40} width="70%" className="mb-4" />
        <LoadingSkeleton count={3} height={80} className="mb-4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Digests</h2>
        <p className="text-gray-700 mb-4">{error}</p>
        <button
          onClick={loadContentData}
          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Navigation with Period Selection */}
        <div className="flex items-center gap-2 mb-8">
          {/* The "Generate" button is removed as DigestPeriodSection handles its own data */}
          {/* <div style={{ width: "5px" }} /> */} {/* Spacer removed or adjusted if needed */}

          <div className="flex bg-gray-100 rounded-lg p-1 flex-1">
            {(["weekly", "monthly", "quarterly"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setActiveDigestType(type)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium capitalize transition-all duration-200 ${
                  activeDigestType === type ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Render the new DigestPeriodSection based on activeDigestType */}
        {/* Map 'weekly' to 'week', 'monthly' to 'month', 'quarterly' to 'quarter' */}
        <DigestPeriodSection
          key={activeDigestType} // Add key to force re-mount and re-fetch when period changes
          period={activeDigestType === 'weekly' ? 'week' : activeDigestType === 'monthly' ? 'month' : 'quarter'}
          initialDigestData={
            // Pass initialAiDigest only if it's for the currently active default period ('weekly' -> 'week')
            // And if initialAiDigest itself exists and its timeframe matches
            (activeDigestType === 'weekly' && initialAiDigest && initialAiDigest.timeframe === 'weekly')
            // Add similar checks if app/page.tsx could fetch for other initial periods
            // || (activeDigestType === 'monthly' && initialAiDigest && initialAiDigest.timeframe === 'monthly')
            // || (activeDigestType === 'quarterly' && initialAiDigest && initialAiDigest.timeframe === 'quarterly')
              ? initialAiDigest
              : undefined // Pass undefined if not applicable, so DigestPeriodSection fetches
          }
        />

        {/* Preview of Stored Content (Optional - kept for now) */}
        {!isLoading && !error && storedContent.length > 0 && (
          <div className="mt-12"> {/* Added margin top for separation */}
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm font-medium">
                  Preview: {storedContent.length} analyzed articles for the selected '{activeDigestType}' period.
                </span>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Analyzed Content Preview (for selected period)</h3>
              <div className="space-y-2">{contentItems}</div>
              {storedContent.length > 10 && (
                <p className="text-sm text-gray-600 text-center">
                  Showing first 10 of {storedContent.length} analyzed articles
                </p>
              )}
            </div>
          </div>
        )}

        {!isLoading && !error && storedContent.length === 0 && (
           <div className="mt-12 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
             <div className="flex items-center gap-2 text-amber-800">
               <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
               <span className="text-sm font-medium">
                 No analyzed articles found for the '{activeDigestType}' period to preview.
               </span>
             </div>
           </div>
        )}


        {/* Full Read Modal */}
        <FullReadModal
          isOpen={!!selectedFullRead}
          onClose={() => setSelectedFullRead(null)}
          title={selectedFullRead?.title || ""}
          content={selectedFullRead?.content || ""}
          url={selectedFullRead?.url}
        />
      </div>
    </ErrorBoundary>
  )
}
