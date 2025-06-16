"use client"

import { useEffect, useState } from "react"
import { X, ExternalLink, Network } from "lucide-react"
import { getConceptDetails, type ConceptNode } from "@/lib/concept-map-data"

interface ConceptDetailsSidebarProps {
  selectedNodeId: string | null
  onClose: () => void
  onConceptClick: (conceptId: string) => void
}

export default function ConceptDetailsSidebar({ selectedNodeId, onClose, onConceptClick }: ConceptDetailsSidebarProps) {
  const [concept, setConcept] = useState<ConceptNode | null>(null)
  const [relatedConcepts, setRelatedConcepts] = useState<ConceptNode[]>([])
  const [articles, setArticles] = useState<any[]>([])

  useEffect(() => {
    if (selectedNodeId) {
      const details = getConceptDetails(selectedNodeId)
      setConcept(details.concept)
      setRelatedConcepts(details.relatedConcepts)
      setArticles(details.articles)
    }
  }, [selectedNodeId])

  if (!selectedNodeId || !concept) return null

  const getDensityColor = (density: number) => {
    const intensity = density / 100
    const blue = Math.floor(59 + (130 - 59) * intensity)
    const green = Math.floor(130 + (59 - 130) * intensity)
    const red = Math.floor(246 + (29 - 246) * intensity)
    return `rgb(${red}, ${green}, ${blue})`
  }

  const getDensityLabel = (density: number) => {
    if (density < 20) return "Emerging"
    if (density < 50) return "Growing"
    if (density < 80) return "Established"
    return "Core"
  }

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto animate-in slide-in-from-right duration-300">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Concept Details</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Concept Info */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: getDensityColor(concept.density) }}
            />
            <div>
              <h4 className="font-medium text-gray-900">{concept.label}</h4>
              <p className="text-sm text-gray-500">
                {getDensityLabel(concept.density)} • {concept.articles.length} articles
              </p>
            </div>
          </div>

          {concept.description && <p className="text-sm text-gray-700 leading-relaxed">{concept.description}</p>}
        </div>

        {/* Related Concepts */}
        {relatedConcepts.length > 0 && (
          <div className="mb-6">
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Network className="h-4 w-4" />
              Related Concepts
            </h5>
            <div className="space-y-2">
              {relatedConcepts.slice(0, 5).map((relatedConcept) => (
                <button
                  key={relatedConcept.id}
                  onClick={() => onConceptClick(relatedConcept.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: getDensityColor(relatedConcept.density) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{relatedConcept.label}</p>
                    <p className="text-xs text-gray-500">{relatedConcept.articles.length} articles</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Articles */}
        <div>
          <h5 className="font-medium text-gray-900 mb-3">Recent Articles</h5>
          <div className="space-y-3">
            {articles.slice(0, 3).map((article) => (
              <div key={article.id} className="p-3 bg-gray-50 rounded-lg">
                <h6 className="font-medium text-gray-900 text-sm mb-1 flex items-center gap-2">
                  {article.title}
                  <ExternalLink className="h-3 w-3 text-gray-400" />
                </h6>
                <p className="text-xs text-gray-600 leading-relaxed">{article.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
