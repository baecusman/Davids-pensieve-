"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { digestService } from "@/lib/services/digest-service"
import { useAuth } from "@/components/auth/auth-provider"

const DigestsView: React.FC = () => {
  const [digests, setDigests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadDigests()
    }
  }, [user])

  const loadDigests = async () => {
    try {
      setLoading(true)
      const digests = await digestService.getUserDigests(user!.id)
      setDigests(digests)
    } catch (error) {
      console.error("Error loading digests:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDigest = async (type: "weekly" | "monthly" | "quarterly") => {
    try {
      setGenerating(true)
      await digestService.generateDigest(user!.id, type)
      await loadDigests()
    } catch (error) {
      console.error("Error generating digest:", error)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <h1>Digests</h1>

      <div>
        <button onClick={() => handleGenerateDigest("weekly")} disabled={generating}>
          {generating ? "Generating..." : "Generate Weekly Digest"}
        </button>
        <button onClick={() => handleGenerateDigest("monthly")} disabled={generating}>
          {generating ? "Generating..." : "Generate Monthly Digest"}
        </button>
        <button onClick={() => handleGenerateDigest("quarterly")} disabled={generating}>
          {generating ? "Generating..." : "Generate Quarterly Digest"}
        </button>
      </div>

      {loading ? (
        <p>Loading digests...</p>
      ) : (
        <ul>
          {digests.map((digest) => (
            <li key={digest.id}>
              {digest.type} - {digest.created_at}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default DigestsView
