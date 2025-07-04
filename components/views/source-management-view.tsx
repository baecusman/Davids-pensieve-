"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { ContentProcessor } from "@/lib/content-processor"
import { rssProcessor } from "@/lib/rss-processor"
import { twitterProcessor } from "@/lib/twitter-processor"
import { podcastProcessor } from "@/lib/podcast-processor"
import {
  Trash2,
  ExternalLink,
  Calendar,
  Tag,
  Zap,
  BookOpen,
  Scan,
  AlertCircle,
  Rss,
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Twitter,
  Headphones,
  Loader2,
} from "lucide-react";
import LoadingSkeleton from "../ui/LoadingSkeleton";

export default function SourceManagementView() {
  const [sourceUrl, setSourceUrl] = useState("")
  const [sourceType, setSourceType] = useState<"one-off" | "subscription">("one-off")
  const [subscriptionType, setSubscriptionType] = useState<"rss" | "twitter" | "podcast">("rss")
  const [rssInterval, setRssInterval] = useState(60) // minutes
  const [twitterHandle, setTwitterHandle] = useState("")
  const [podcastType, setPodcastType] = useState<"episode" | "subscription">("episode")
  const [isProcessing, setIsProcessing] = useState(false) // For form submission
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [analysisResult, setAnalysisResult] = useState<any>(null)

  const [storedSources, setStoredSources] = useState<any[]>([])
  const [rssFeeds, setRssFeeds] = useState<any[]>([])
  const [twitterFeeds, setTwitterFeeds] = useState<any[]>([])
  const [podcastFeeds, setPodcastFeeds] = useState<any[]>([])

  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"sources" | "feeds" | "twitter" | "podcasts">("sources")
  const [rssStatus, setRssStatus] = useState<any>({})

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const sourcesResult = await ContentProcessor.getStoredContent();
      const sources = Array.isArray(sourcesResult) ? sourcesResult : sourcesResult.items || [];

      const feeds = await rssProcessor.getFeeds();
      const twitterAccounts = await twitterProcessor.getAccounts();
      const podcasts = await podcastProcessor.getSubscriptions();
      const status = await rssProcessor.getProcessingStatus();

      console.log(
        "Loaded:",
        sources.length, "sources,",
        feeds.length, "feeds,",
        twitterAccounts.length, "twitter,",
        podcasts.length, "podcasts"
      );

      setStoredSources(sources);
      setRssFeeds(feeds);
      setTwitterFeeds(twitterAccounts);
      setPodcastFeeds(podcasts);
      setRssStatus(status);

    } catch (error: any) {
      console.error("Error loading data:", error);
      setDataError(`Failed to load source data: ${error.message || "Unknown error"}`);
      setStoredSources([]);
      setRssFeeds([]);
      setTwitterFeeds([]);
      setPodcastFeeds([]);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => { loadData(); }, 100); // Initial load
    return () => clearTimeout(timeoutId);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 60000); // 1 minute

    const handleUpdate = (event: any) => {
      console.log("Update received:", event.detail);
      loadData();
      setProcessingStatus(`✅ Processed ${event.detail.newItemCount || 1} new items`);
      setTimeout(() => setProcessingStatus(""), 5000);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("rss-update", handleUpdate);
      window.addEventListener("twitter-update", handleUpdate);
      window.addEventListener("podcast-update", handleUpdate);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("rss-update", handleUpdate);
        window.removeEventListener("twitter-update", handleUpdate);
        window.removeEventListener("podcast-update", handleUpdate);
      }
    };
  }, [loadData]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!sourceUrl.trim()) {
        setProcessingStatus("❌ Please enter a valid URL");
        setTimeout(() => setProcessingStatus(""), 3000);
        return;
      }
      setIsProcessing(true);
      setProcessingStatus("Starting analysis...");
      setAnalysisResult(null);
      try {
        if (sourceType === "one-off") {
          if (sourceUrl.includes("spotify.com/episode") || sourceUrl.includes("podcasts.apple.com")) {
            setProcessingStatus("🎧 Processing podcast episode...");
            const analysis = await podcastProcessor.processEpisode(sourceUrl);
            setProcessingStatus("✅ Podcast episode analyzed and stored!");
            setAnalysisResult(analysis);
          } else {
            setProcessingStatus("🔍 Fetching content from URL...");
            const analysis = await ContentProcessor.analyzeUrl(sourceUrl);
            setProcessingStatus("✅ Analysis complete and stored in database!");
            setAnalysisResult(analysis);
          }
          setTimeout(async () => {
            await loadData();
            setProcessingStatus("📚 Source added to library!");
            setTimeout(() => setProcessingStatus(""), 3000);
          }, 1000);
          setSourceUrl("");
        } else {
          switch (subscriptionType) {
            case "rss":
              setProcessingStatus("🔍 Testing RSS feed...");
              const rssResult = await rssProcessor.addFeed(sourceUrl, rssInterval);
              if (rssResult.success) {
                setProcessingStatus(`✅ RSS feed added: ${rssResult.feed?.title}`);
                await loadData();
                setSourceUrl("");
              } else {
                setProcessingStatus(`❌ Failed to add RSS feed: ${rssResult.error}`);
              }
              break;
            case "twitter":
              setProcessingStatus("🐦 Adding Twitter account...");
              const twitterResult = await twitterProcessor.addAccount(twitterHandle || sourceUrl);
              if (twitterResult.success) {
                setProcessingStatus(`✅ Twitter account added: @${twitterResult.account?.handle}`);
                await loadData();
                setTwitterHandle("");
                setSourceUrl("");
              } else {
                setProcessingStatus(`❌ Failed to add Twitter account: ${twitterResult.error}`);
              }
              break;
            case "podcast":
              setProcessingStatus("🎧 Adding podcast subscription...");
              const podcastResult = await podcastProcessor.addSubscription(sourceUrl);
              if (podcastResult.success) {
                setProcessingStatus(`✅ Podcast subscription added: ${podcastResult.podcast?.title}`);
                await loadData();
                setSourceUrl("");
              } else {
                setProcessingStatus(`❌ Failed to add podcast: ${podcastResult.error}`);
              }
              break;
          }
          setTimeout(() => setProcessingStatus(""), 5000);
        }
      } catch (error) {
        console.error("Error processing source:", error);
        setProcessingStatus("❌ Error: Failed to process content. Please try again.");
        setTimeout(() => setProcessingStatus(""), 5000);
      } finally {
        setIsProcessing(false);
      }
    },
    [sourceUrl, sourceType, subscriptionType, rssInterval, twitterHandle, podcastType, loadData],
  );

  const handleDeleteSource = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`Are you sure you want to remove "${title}"?`)) return;

      setIsDeleting(id);
      try {
        const success = await ContentProcessor.deleteContent(id);
        if (success) {
          await loadData();
          setProcessingStatus(`✅ Removed "${title}"`);
        } else {
          setProcessingStatus(`❌ Failed to remove "${title}"`);
        }
      } catch (error) {
        console.error("Error deleting source:", error);
        setProcessingStatus(`❌ Error removing "${title}"`);
      } finally {
        setIsDeleting(null);
        setTimeout(() => setProcessingStatus(""), 3000);
      }
    },
    [loadData],
  );

  const handleToggleFeed = useCallback(
    async (feedId: string, type: "rss" | "twitter" | "podcast") => {
      try {
        let isActive = false;
        switch (type) {
          case "rss":
            isActive = await rssProcessor.toggleFeed(feedId);
            break;
          case "twitter":
            isActive = await twitterProcessor.toggleAccount(feedId);
            break;
          case "podcast":
            isActive = await podcastProcessor.toggleSubscription(feedId);
            break;
        }
        await loadData();
        setProcessingStatus(`✅ ${type.toUpperCase()} feed ${isActive ? "activated" : "paused"}`);
      } catch (error) {
        console.error("Error toggling feed:", error);
        setProcessingStatus("❌ Error updating feed");
      }
      setTimeout(() => setProcessingStatus(""), 3000);
    },
    [loadData],
  );

  const getPriorityIcon = useMemo(
    () => (priority: string) => {
      switch (priority) {
        case "deep-dive": return <Zap className="h-4 w-4 text-purple-600" />;
        case "read": return <BookOpen className="h-4 w-4 text-blue-600" />;
        case "skim": return <Scan className="h-4 w-4 text-gray-500" />;
        default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
      }
    },
    [],
  );

  const getPriorityColor = useMemo(
    () => (priority: string) => {
      switch (priority) {
        case "deep-dive": return "bg-purple-100 text-purple-800 border-purple-200";
        case "read": return "bg-blue-100 text-blue-800 border-blue-200";
        case "skim": return "bg-gray-100 text-gray-800 border-gray-200";
        default: return "bg-gray-100 text-gray-600 border-gray-200";
      }
    },
    [],
  );

  const formatInterval = useCallback((minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }, []);

  if (isLoadingData && storedSources.length === 0 && rssFeeds.length === 0 && twitterFeeds.length === 0 && podcastFeeds.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 mb-8">
          <LoadingSkeleton height={30} width="60%" className="mb-6" />
          <LoadingSkeleton count={2} height={40} className="mb-4" />
          <LoadingSkeleton height={50} />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8">
          <LoadingSkeleton height={30} width="40%" className="mb-6" />
          <LoadingSkeleton count={3} height={60} className="mb-4" />
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Sources</h2>
        <p className="text-gray-600 mb-4">{dataError}</p>
        <button
          onClick={loadData}
          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Add Source Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8 mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 md:mb-8">Add Content Source</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-700 mb-2">
              {subscriptionType === "twitter"
                ? "Twitter Handle or URL"
                : subscriptionType === "podcast"
                  ? "Podcast URL (Spotify/Apple)"
                  : "Source URL"}
            </label>
            <input
              type={subscriptionType === "twitter" ? "text" : "url"}
              id="sourceUrl"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={
                subscriptionType === "twitter"
                  ? "@username or https://twitter.com/username"
                  : subscriptionType === "podcast"
                    ? "https://open.spotify.com/episode/... or https://podcasts.apple.com/..."
                    : sourceType === "one-off"
                      ? "https://example.com/article"
                      : "https://example.com/feed.xml"
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base md:text-lg"
              required
              disabled={isProcessing}
            />
          </div>

          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Source Type</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="sourceType"
                  value="one-off"
                  checked={sourceType === "one-off"}
                  onChange={(e) => setSourceType(e.target.value as "one-off" | "subscription")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  disabled={isProcessing}
                />
                <span className="ml-2 text-sm text-gray-700 font-medium">One-off Analysis</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="sourceType"
                  value="subscription"
                  checked={sourceType === "subscription"}
                  onChange={(e) => setSourceType(e.target.value as "one-off" | "subscription")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  disabled={isProcessing}
                />
                <span className="ml-2 text-sm text-gray-700">Subscription</span>
              </label>
            </div>
          </div>

          {/* Subscription Details */}
          {sourceType === "subscription" && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Subscription Type</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="subscriptionType"
                      value="rss"
                      checked={subscriptionType === "rss"}
                      onChange={(e) => setSubscriptionType(e.target.value as "rss" | "twitter" | "podcast")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      disabled={isProcessing}
                    />
                    <Rss className="h-4 w-4 ml-2 mr-1 text-orange-500" />
                    <span className="text-sm text-gray-700">RSS Feed</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="subscriptionType"
                      value="twitter"
                      checked={subscriptionType === "twitter"}
                      onChange={(e) => setSubscriptionType(e.target.value as "rss" | "twitter" | "podcast")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      disabled={isProcessing}
                    />
                    <Twitter className="h-4 w-4 ml-2 mr-1 text-blue-500" />
                    <span className="text-sm text-gray-700">Twitter</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="subscriptionType"
                      value="podcast"
                      checked={subscriptionType === "podcast"}
                      onChange={(e) => setSubscriptionType(e.target.value as "rss" | "twitter" | "podcast")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      disabled={isProcessing}
                    />
                    <Headphones className="h-4 w-4 ml-2 mr-1 text-purple-500" />
                    <span className="text-sm text-gray-700">Podcast</span>
                  </label>
                </div>
              </div>

              {subscriptionType === "rss" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check Interval: {formatInterval(rssInterval)}
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="1440"
                    step="15"
                    value={rssInterval}
                    onChange={(e) => setRssInterval(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    disabled={isProcessing}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>15min</span>
                    <span>24h</span>
                  </div>
                </div>
              )}

              {subscriptionType === "podcast" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Podcast Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="podcastType"
                        value="episode"
                        checked={podcastType === "episode"}
                        onChange={(e) => setPodcastType(e.target.value as "episode" | "subscription")}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        disabled={isProcessing}
                      />
                      <span className="ml-2 text-sm text-gray-700">Single Episode</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="podcastType"
                        value="subscription"
                        checked={podcastType === "subscription"}
                        onChange={(e) => setPodcastType(e.target.value as "episode" | "subscription")}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        disabled={isProcessing}
                      />
                      <span className="ml-2 text-sm text-gray-700">Subscribe to Show</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isProcessing || !sourceUrl.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {isProcessing
                ? "Processing..."
                : sourceType === "one-off"
                  ? "Analyze"
                  : `Add ${subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)}`}
            </button>
          </div>
        </form>

        {/* Processing Status */}
        {processingStatus && (
          <div
            className={`mt-6 p-4 rounded-lg border ${
              processingStatus.includes("❌")
                ? "bg-red-50 border-red-200"
                : processingStatus.includes("✅")
                  ? "bg-green-50 border-green-200"
                  : processingStatus.includes("⚠️")
                    ? "bg-amber-50 border-amber-200"
                    : "bg-blue-50 border-blue-200"
            }`}
          >
            <p
              className={`text-sm ${
                processingStatus.includes("❌")
                  ? "text-red-800"
                  : processingStatus.includes("✅")
                    ? "text-green-800"
                    : processingStatus.includes("⚠️")
                      ? "text-amber-800"
                      : "text-blue-800"
              }`}
            >
              {processingStatus}
            </p>
          </div>
        )}

        {/* Analysis Result */}
        {analysisResult && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">🎉 Analysis Complete!</h3>
            <div className="text-sm text-green-800 space-y-2">
              <p>
                <strong>Summary:</strong> {analysisResult.summary.sentence}
              </p>
              <p>
                <strong>Priority:</strong> <span className="capitalize">{analysisResult.priority}</span>
              </p>
              <p>
                <strong>Tags:</strong> {analysisResult.tags.join(", ")}
              </p>
              <p className="text-xs text-green-600">✅ Stored in database with full concept mapping</p>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {(!isLoadingData && !dataError && (rssStatus.activeFeeds > 0 || twitterFeeds.length > 0 || podcastFeeds.length > 0)) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-blue-800">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">
              Active: {rssStatus.activeFeeds || 0} RSS • {twitterFeeds.filter((f) => f.isActive).length} Twitter •{" "}
              {podcastFeeds.filter((f) => f.isActive).length} Podcasts
              {rssStatus.processingUrls > 0 && ` • ${rssStatus.processingUrls} analyzing now`}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {[
              { id: "sources", label: "Sources", count: storedSources.length },
              { id: "feeds", label: "RSS", count: rssFeeds.length, icon: Rss },
              { id: "twitter", label: "Twitter", count: twitterFeeds.length, icon: Twitter },
              { id: "podcasts", label: "Podcasts", count: podcastFeeds.length, icon: Headphones },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-8">
          {/* Sources Tab */}
          {activeTab === "sources" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">
                  Analyzed Sources ({storedSources.length})
                </h3>
              </div>

              {isLoadingData ? (
                 <LoadingSkeleton count={3} height={70} className="mb-4" />
              ) : dataError ? (
                <div className="text-center py-12 text-red-600">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>{dataError}</p>
                </div>
              ) : storedSources.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No sources analyzed yet</h4>
                  <p className="text-gray-600 mb-4">Add your first source using the form above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {storedSources.map((source) => (
                    <div
                      key={source.id}
                      className="border border-gray-200 rounded-lg p-4 md:p-6 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 truncate">{source.title}</h4>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              title="Open original article"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {source.analysis?.summary?.sentence || "No summary available"}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(source.createdAt).toLocaleDateString()}
                            </div>
                            {source.analysis?.tags && source.analysis.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {source.analysis.tags.slice(0, 2).join(", ")}
                                {source.analysis.tags.length > 2 && ` +${source.analysis.tags.length - 2}`}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          {source.analysis?.priority && (
                            <div
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(source.analysis.priority)}`}
                            >
                              {getPriorityIcon(source.analysis.priority)}
                              <span className="capitalize">{source.analysis.priority}</span>
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteSource(source.id, source.title)}
                            disabled={isDeleting === source.id}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Remove source"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RSS Feeds Tab */}
          {activeTab === "feeds" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">RSS Feeds ({rssFeeds.length})</h3>
              </div>
              {isLoadingData ? (
                 <LoadingSkeleton count={2} height={70} className="mb-4" />
              ) : dataError ? (
                 <div className="text-center py-12 text-red-600"><p>{dataError}</p></div>
              ) : rssFeeds.length === 0 ? (
                <div className="text-center py-12">
                  <Rss className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No RSS feeds added yet</h4>
                  <p className="text-gray-600 mb-4">Add your first RSS feed using the form above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rssFeeds.map((feed) => (
                    <div
                      key={feed.id}
                      className="border border-gray-200 rounded-lg p-4 md:p-6 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Rss className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <h4 className="font-medium text-gray-900 truncate">{feed.title}</h4>
                            <a
                              href={feed.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              title="Open RSS feed"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>

                          {feed.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{feed.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Every {formatInterval(feed.fetchInterval)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Last: {new Date(feed.lastFetched).toLocaleDateString()}
                            </div>
                            <div>{feed.itemCount} items processed</div>
                          </div>

                          <div className="flex items-center gap-2">
                            {feed.isActive ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                <span className="text-xs">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-500">
                                <Pause className="h-3 w-3" />
                                <span className="text-xs">Paused</span>
                              </div>
                            )}

                            {feed.errorCount > 0 && (
                              <div className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-3 w-3" />
                                <span className="text-xs">{feed.errorCount} errors</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleToggleFeed(feed.id, "rss")}
                            className={`p-2 rounded-lg transition-colors ${
                              feed.isActive ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"
                            }`}
                            title={feed.isActive ? "Pause feed" : "Resume feed"}
                          >
                            {feed.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>

                          <button
                            onClick={() => rssProcessor.removeFeed(feed.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove feed"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Twitter Tab */}
          {activeTab === "twitter" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">
                  Twitter Accounts ({twitterFeeds.length})
                </h3>
              </div>
               {isLoadingData ? (
                 <LoadingSkeleton count={2} height={70} className="mb-4" />
              ) : dataError ? (
                 <div className="text-center py-12 text-red-600"><p>{dataError}</p></div>
              ) : twitterFeeds.length === 0 ? (
                <div className="text-center py-12">
                  <Twitter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Twitter accounts added yet</h4>
                  <p className="text-gray-600 mb-4">Add your first Twitter account using the form above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {twitterFeeds.map((account) => (
                    <div
                      key={account.id}
                      className="border border-gray-200 rounded-lg p-4 md:p-6 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Twitter className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <h4 className="font-medium text-gray-900">@{account.handle}</h4>
                            <a
                              href={`https://twitter.com/${account.handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              title="Open Twitter profile"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Added: {new Date(account.createdAt).toLocaleDateString()}
                            </div>
                            <div>{account.tweetCount || 0} tweets processed</div>
                          </div>

                          <div className="flex items-center gap-2">
                            {account.isActive ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                <span className="text-xs">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-500">
                                <Pause className="h-3 w-3" />
                                <span className="text-xs">Paused</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleToggleFeed(account.id, "twitter")}
                            className={`p-2 rounded-lg transition-colors ${
                              account.isActive ? "text-blue-600 hover:bg-blue-50" : "text-green-600 hover:bg-green-50"
                            }`}
                            title={account.isActive ? "Pause monitoring" : "Resume monitoring"}
                          >
                            {account.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>

                          <button
                            onClick={() => twitterProcessor.removeAccount(account.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Podcasts Tab */}
          {activeTab === "podcasts" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">
                  Podcast Subscriptions ({podcastFeeds.length})
                </h3>
              </div>
              {isLoadingData ? (
                 <LoadingSkeleton count={2} height={70} className="mb-4" />
              ) : dataError ? (
                 <div className="text-center py-12 text-red-600"><p>{dataError}</p></div>
              ) : podcastFeeds.length === 0 ? (
                <div className="text-center py-12">
                  <Headphones className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No podcast subscriptions yet</h4>
                  <p className="text-gray-600 mb-4">Add your first podcast using the form above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {podcastFeeds.map((podcast) => (
                    <div
                      key={podcast.id}
                      className="border border-gray-200 rounded-lg p-4 md:p-6 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Headphones className="h-4 w-4 text-purple-500 flex-shrink-0" />
                            <h4 className="font-medium text-gray-900 truncate">{podcast.title}</h4>
                            <a
                              href={podcast.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              title="Open podcast"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>

                          {podcast.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{podcast.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Added: {new Date(podcast.createdAt).toLocaleDateString()}
                            </div>
                            <div>{podcast.episodeCount || 0} episodes processed</div>
                          </div>

                          <div className="flex items-center gap-2">
                            {podcast.isActive ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                <span className="text-xs">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-500">
                                <Pause className="h-3 w-3" />
                                <span className="text-xs">Paused</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleToggleFeed(podcast.id, "podcast")}
                            className={`p-2 rounded-lg transition-colors ${
                              podcast.isActive
                                ? "text-purple-600 hover:bg-purple-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                            title={podcast.isActive ? "Pause subscription" : "Resume subscription"}
                          >
                            {podcast.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>

                          <button
                            onClick={() => podcastProcessor.removeSubscription(podcast.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove subscription"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
>>>>>>> REPLACE
