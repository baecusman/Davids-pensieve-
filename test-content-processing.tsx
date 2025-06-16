"use client"

import { useState, useEffect } from "react"
import { simpleAuth } from "@/lib/auth/simple-auth"
import { ContentProcessor } from "@/lib/content-processor"
import { rssProcessor } from "@/lib/rss-processor"
import { podcastProcessor } from "@/lib/podcast-processor"

export default function TestContentProcessing() {
  const [results, setResults] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    // Initialize and login as user 2
    if (typeof window !== "undefined") {
      simpleAuth.initialize()
      const loginResult = simpleAuth.login("2", "2")
      if (loginResult.success) {
        setCurrentUser(loginResult.user)
        console.log("Logged in as user 2")
      }
    }
  }, [])

  const testUrls = [
    {
      type: "one-off",
      category: "Podcast Episode",
      url: "https://open.spotify.com/episode/3MzJ3YYyiDFbX8WANmNbrs",
    },
    {
      type: "one-off",
      category: "Article",
      url: "https://www.lennysnewsletter.com/p/why-ubers-cpo-delivers-food-on-weekends-sachin-kansal",
    },
    {
      type: "one-off",
      category: "Twitter Profile",
      url: "https://x.com/akshay_pachaar",
    },
    {
      type: "subscription",
      category: "RSS Feed",
      url: "http://stratechery.com/feed",
    },
  ]

  const processAllUrls = async () => {
    if (!currentUser) {
      console.error("Not logged in as user 2")
      return
    }

    setIsProcessing(true)
    setResults([])

    for (const testItem of testUrls) {
      try {
        console.log(`\n=== Processing ${testItem.category}: ${testItem.url} ===`)

        let result: any = {}

        if (testItem.type === "one-off") {
          if (testItem.category === "Podcast Episode") {
            // Test podcast episode processing
            result = await podcastProcessor.processEpisode(testItem.url)
            result.processedBy = "podcastProcessor.processEpisode"
          } else {
            // Test regular URL analysis
            result = await ContentProcessor.analyzeUrl(testItem.url)
            result.processedBy = "ContentProcessor.analyzeUrl"
          }
        } else if (testItem.type === "subscription") {
          // Test RSS subscription
          result = await rssProcessor.addFeed(testItem.url, 60)
          result.processedBy = "rssProcessor.addFeed"
        }

        setResults((prev) => [
          ...prev,
          {
            ...testItem,
            result,
            status: "success",
            timestamp: new Date().toISOString(),
          },
        ])

        console.log(`✅ Successfully processed ${testItem.category}`)

        // Wait between requests to avoid overwhelming
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error) {
        console.error(`❌ Error processing ${testItem.category}:`, error)

        setResults((prev) => [
          ...prev,
          {
            ...testItem,
            result: null,
            error: error instanceof Error ? error.message : "Unknown error",
            status: "error",
            timestamp: new Date().toISOString(),
          },
        ])
      }
    }

    setIsProcessing(false)
    console.log("\n=== All processing complete ===")
  }

  const checkStoredContent = () => {
    const storedContent = ContentProcessor.getStoredContent()
    console.log("Stored content for user 2:", storedContent)

    const rssFeeds = rssProcessor.getFeeds()
    console.log("RSS feeds for user 2:", rssFeeds)
  }

  if (!currentUser) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to login as user 2. Please check the authentication system.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Content Processing Test</h1>
        <p className="text-gray-600 mb-4">
          Logged in as: <strong>{currentUser.displayName}</strong> (User {currentUser.username})
        </p>

        <div className="flex gap-4 mb-6">
          <button
            onClick={processAllUrls}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isProcessing ? "Processing..." : "Test All URLs"}
          </button>

          <button
            onClick={checkStoredContent}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Check Stored Content
          </button>
        </div>

        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-800">Processing URLs...</span>
            </div>
          </div>
        )}
      </div>

      {/* Test URLs List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test URLs</h2>
        <div className="space-y-3">
          {testUrls.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    item.type === "one-off" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {item.type}
                </span>
                <span className="font-medium text-gray-900">{item.category}</span>
              </div>
              <p className="text-sm text-gray-600 font-mono break-all">{item.url}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing Results</h2>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      result.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {result.status}
                  </span>
                  <span className="font-medium text-gray-900">{result.category}</span>
                  <span className="text-xs text-gray-500">{result.processedBy}</span>
                </div>

                <p className="text-sm text-gray-600 font-mono break-all mb-3">{result.url}</p>

                {result.status === "success" ? (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <pre className="text-xs text-green-800 overflow-auto max-h-40">
                      {JSON.stringify(result.result, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm text-red-800">{result.error}</p>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Processed at: {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
