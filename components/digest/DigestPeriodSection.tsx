"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ContentProcessor } from '@/lib/content-processor';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { AlertCircle, Calendar, TrendingUp, Zap, BookOpen, Scan, ExternalLink } from 'lucide-react';

type Period = 'week' | 'month' | 'quarter'; // Renamed from 'weekly' etc. to match common usage

interface DigestPeriodSectionProps {
  period: Period;
  initialDigestData?: DigestData | null; // New prop for initial data
  // If this component is user-specific and data fetching depends on user, a userId prop might be needed.
  // For now, assuming ContentProcessor methods don't require explicit userId here or handle it internally.
}

interface DigestData {
  timeframe: string;
  generatedAt: string;
  summary: string;
  trendingConcepts: Array<{ name: string; reason: string; importance: string; trendType: string }>;
  items: Array<any>; // Define a proper type for digest items if available
  stats: {
    totalArticles: number;
    analyzedArticles?: number; // Optional as per DigestView
    historicalArticles?: number; // Optional
    deepDiveCount: number;
    readCount: number;
    skimCount: number;
  };
}

const DigestPeriodSection: React.FC<DigestPeriodSectionProps> = ({ period, initialDigestData }) => {
  const [digestData, setDigestData] = useState<DigestData | null>(initialDigestData || null);
  // Set initial loading state based on whether initial data is provided
  const [isLoading, setIsLoading] = useState(!initialDigestData);
  const [error, setError] = useState<string | null>(null);

  const fetchDigestData = useCallback(async (isInitialCall: boolean) => {
    // If it's the initial call and initialDigestData is present, don't re-fetch.
    if (isInitialCall && initialDigestData) {
      setDigestData(initialDigestData);
      setIsLoading(false);
      return;
    }
    // If initialData was for a different period (which shouldn't happen if key prop is used correctly on parent)
    // or if this is a subsequent fetch (e.g. retry), then proceed.

    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Fetch articles for the period
      // Map 'week' to 'weekly', 'month' to 'monthly', 'quarter' to 'quarterly' for ContentProcessor
      const timeframeMap = {
        week: 'weekly',
        month: 'monthly',
        quarter: 'quarterly',
      };
      const apiTimeframe = timeframeMap[period] as 'weekly' | 'monthly' | 'quarterly';

      // getStoredContent returns items directly or an object like { items: [], total: 0, hasMore: false }
      // Let's assume it returns items directly as adapted in DigestsView
      const articles = await ContentProcessor.getStoredContent({
        limit: 100, // Adjust as needed, or make it a prop
        timeframe: apiTimeframe,
      });

      if (!articles || articles.length === 0) {
        // Set a specific state for no articles, or handle as empty digest
        setDigestData(null); // Or a minimal digest structure indicating no articles
        // setError(`No articles found for the ${period} to generate a digest.`);
        // Or, let generateDigest handle it if it can produce a meaningful empty digest
        console.log(`No articles found for ${period} to generate a digest. Attempting to generate empty digest.`);
        // Fall through to generateDigest, which might return a default/empty digest
      }

      // Convert articles to the format expected by generateDigest if necessary
      // The DigestItem interface in app/api/digest/generate/route.ts has:
      // title, summary, fullSummary, summaryType, priority, url, conceptTags, analyzedAt, source
      // The 'articles' from getStoredContent have:
      // id, title, url, contentSummary, analysis { summaryText, entitiesSimplified, tags, priority }, createdAt, source
      const digestItemsInput = articles.map((article: any) => ({
        title: article.title,
        summary: article.analysis?.summaryText || article.contentSummary || "No summary available",
        fullSummary: article.analysis?.fullSummary || "", // Assuming fullSummary might exist
        summaryType: article.analysis?.summaryType || "paragraph", // Default or derive
        priority: article.analysis?.priority || "read",
        url: article.url,
        conceptTags: article.analysis?.tags || [],
        analyzedAt: article.createdAt || new Date().toISOString(),
        source: article.source || "analyzed", // Default source
        fullContent: article.analysis?.fullContent || "", // Assuming fullContent might exist
      }));


      // Step 2: Generate digest using these articles
      const generatedDigest = await ContentProcessor.generateDigest(apiTimeframe, digestItemsInput);
      setDigestData(generatedDigest);

    } catch (err: any) {
      console.error(`Error fetching or generating ${period} digest:`, err);
      setError(`Failed to load ${period} digest: ${err.message || 'Unknown error'}`);
      setDigestData(null);
    } finally {
      setIsLoading(false);
    }
  }, [period, initialDigestData]); // Add initialDigestData to dependencies

  useEffect(() => {
    // Pass true for the initial call context
    fetchDigestData(true);
  }, [fetchDigestData]); // fetchDigestData now includes initialDigestData in its own deps

  if (isLoading) {
    return (
      <div className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
        <LoadingSkeleton height={30} width="40%" className="mb-4" />
        <LoadingSkeleton count={3} className="mb-2" />
        <LoadingSkeleton height={20} width="60%" className="mt-4 mb-3" />
        <LoadingSkeleton count={2} height={50} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
        <AlertCircle className="mx-auto h-8 w-8 mb-2" />
        <p className="font-semibold">Error loading {period} digest:</p>
        <p className="text-sm mb-3">{error}</p>
        <button
          onClick={fetchDigestData}
          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!digestData || digestData.items.length === 0 && digestData.summary.includes("No articles found")) { // A bit heuristic for empty state from AI
    return (
      <div className="p-6 bg-white shadow-lg rounded-lg border border-gray-200 text-center text-gray-500">
        <Calendar className="mx-auto h-10 w-10 mb-2 text-gray-400" />
        <p className="font-semibold">No {period} digest available.</p>
        <p className="text-sm">There were no articles to generate a digest for this period, or the generated digest was empty.</p>
      </div>
    );
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "deep-dive": return <Zap className="h-4 w-4 text-purple-500" />;
      case "read": return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "skim": return <Scan className="h-4 w-4 text-gray-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };


  return (
    <div className="p-4 md:p-6 bg-white shadow-lg rounded-lg border border-gray-200 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800 capitalize">
          {digestData.timeframe} Digest
        </h3>
        <span className="text-xs text-gray-500">
          Generated {new Date(digestData.generatedAt).toLocaleString()}
        </span>
      </div>

      <div className="prose prose-sm max-w-none mb-6 text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: digestData.summary }} />


      {digestData.trendingConcepts && digestData.trendingConcepts.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-indigo-500" />
            Trending Concepts
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {digestData.trendingConcepts.slice(0, 4).map((concept, index) => (
              <div key={index} className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                <h5 className="font-medium text-indigo-800 text-sm">{concept.name}</h5>
                <p className="text-xs text-indigo-700 mt-1">{concept.reason}</p>
                {/* <p className="text-xs text-indigo-600 mt-1 font-medium">{concept.importance}</p> */}
              </div>
            ))}
          </div>
        </div>
      )}

      {digestData.items && digestData.items.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-700 mb-3">Key Articles</h4>
          <div className="space-y-3">
            {digestData.items.slice(0,5).map((item: any, index: number) => ( // Show top 5 articles
              <div key={item.id || index} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                <div className="flex items-center justify-between">
                    <h5 className="font-medium text-gray-800 text-sm mb-1">{item.title}</h5>
                    {getPriorityIcon(item.priority)}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-1">{item.summary || item.description}</p>
                 {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600 flex items-center">
                        Read more <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
        <span>📊 {digestData.stats.totalArticles} total articles</span>
        <span>🎯 {digestData.stats.deepDiveCount} deep-dive</span>
        <span>📖 {digestData.stats.readCount} read</span>
        <span>👁️ {digestData.stats.skimCount} skim</span>
        {digestData.stats.analyzedArticles && (
          <span className="text-blue-600">🔍 {digestData.stats.analyzedArticles} from your content</span>
        )}
      </div>
    </div>
  );
};

export default DigestPeriodSection;
