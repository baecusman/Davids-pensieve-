"use client"

import type React from "react"
import { useEffect } from "react"
import { ContentProcessor } from "../../utils/content-processor"

const DigestsView: React.FC = () => {
  useEffect(() => {
    // Debug: Log content availability for different timeframes
    console.log("=== DIGEST DEBUG INFO ===")
    const weeklyContent = ContentProcessor.getStoredContent({ timeframe: "weekly" })
    const monthlyContent = ContentProcessor.getStoredContent({ timeframe: "monthly" })
    const allContent = ContentProcessor.getStoredContent({})

    console.log("Weekly content:", weeklyContent.length)
    console.log("Monthly content:", monthlyContent.length)
    console.log("All content:", allContent.length)

    if (allContent.length > 0) {
      console.log("Sample content dates:")
      allContent.slice(0, 3).forEach((item) => {
        console.log(`- "${item.title}": ${item.createdAt}`)
      })
    }
  }, [])

  return (
    <div>
      <h1>Digests View</h1>
      {/* Add digest display logic here */}
    </div>
  )
}

export default DigestsView
