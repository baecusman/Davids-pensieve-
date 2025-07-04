"use client"

import { useEffect, useState, useCallback } from "react" // Added useCallback
import { X, ExternalLink, Network, AlertTriangle } from "lucide-react" // Added AlertTriangle
import { getConceptDetails, type ConceptNode } from "@/lib/concept-map-data"
import LoadingSkeleton from "../ui/LoadingSkeleton" // Import LoadingSkeleton

interface ConceptDetailsSidebarProps {
  selectedNodeId: string | null
  onClose: () => void
  onConceptClick: (conceptId: string) => void
}

export default function ConceptDetailsSidebar({ selectedNodeId, onClose, onConceptClick }: ConceptDetailsSidebarProps) {
  const [concept, setConcept] = useState<ConceptNode | null>(null)
  const [relatedConcepts, setRelatedConcepts] = useState<ConceptNode[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async (nodeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const details = await getConceptDetails(nodeId); // getConceptDetails is async
      if (details.concept) {
        setConcept(details.concept);
        setRelatedConcepts(details.relatedConcepts || []);
        setArticles(details.articles || []);
      } else {
        // This case might occur if getConceptDetails returns { concept: null, ... } even on success
        // but for a non-existent ID.
        setError("Concept details not found.");
        setConcept(null);
        setRelatedConcepts([]);
        setArticles([]);
      }
    } catch (err: any) {
      console.error("Error fetching concept details:", err);
      setError(`Failed to load details: ${err.message || "Unknown error"}`);
      setConcept(null);
      setRelatedConcepts([]);
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedNodeId) {
      fetchDetails(selectedNodeId);
    } else {
      // Clear details when no node is selected
      setConcept(null);
      setRelatedConcepts([]);
      setArticles([]);
      setError(null);
      setIsLoading(false); // Ensure loading is false if selection is cleared
    }
  }, [selectedNodeId, fetchDetails]);

  // Do not render the sidebar at all if no node is selected (original behavior)
  if (!selectedNodeId) return null;

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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-4">
          <LoadingSkeleton height={24} width="70%" className="mb-4" /> {/* Title */}
          <LoadingSkeleton count={3} className="mb-2" /> {/* Description lines */}
          <LoadingSkeleton height={20} width="50%" className="mt-6 mb-3" /> {/* Related Concepts Title */}
          <LoadingSkeleton count={2} height={40} className="mb-2" /> {/* Related Concept Items */}
          <LoadingSkeleton height={20} width="50%" className="mt-6 mb-3" /> {/* Recent Articles Title */}
          <LoadingSkeleton count={1} height={60} /> {/* Article Item */}
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 text-center text-red-600">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
          <p className="font-semibold">Error loading details:</p>
          <p className="text-sm mb-3">{error}</p>
          <button
            onClick={() => selectedNodeId && fetchDetails(selectedNodeId)}
            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (!concept) {
      // This case might occur if fetchDetails sets concept to null due to not found,
      // but not an error in fetching itself. Or if selectedNodeId was valid but no data returned.
      return (
        <div className="p-4 text-center text-gray-500">
          <p>Concept details not available or not found.</p>
        </div>
      );
    }

    return (
      <>
        {/* Concept Info */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0"
              style={{ backgroundColor: getDensityColor(concept.density) }}
            />
            <div>
              <h4 className="font-medium text-gray-900">{concept.label}</h4>
              <p className="text-sm text-gray-500">
                {getDensityLabel(concept.density)} • {concept.articles?.length || 0} articles
              </p>
            </div>
          </div>
          {concept.description && <p className="text-sm text-gray-700 leading-relaxed">{concept.description}</p>}
        </div>

        {/* Related Concepts */}
        {relatedConcepts.length > 0 && (
          <div className="mb-6">
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-gray-600" />
              Related Concepts
            </h5>
            <div className="space-y-1">
              {relatedConcepts.slice(0, 5).map((relatedConcept) => (
                <button
                  key={relatedConcept.id}
                  onClick={() => onConceptClick(relatedConcept.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 transition-colors text-left"
                >
                  <div
                    className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: getDensityColor(relatedConcept.density) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{relatedConcept.label}</p>
                    <p className="text-xs text-gray-500">{relatedConcept.articles?.length || 0} articles</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Articles */}
        {articles.length > 0 && (
          <div>
            <h5 className="font-medium text-gray-900 mb-3">Mentioned In Articles</h5>
            <div className="space-y-2">
              {articles.slice(0, 3).map((article) => (
                <div key={article.id} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                  <h6 className="font-medium text-gray-800 text-sm mb-1 flex items-center gap-1.5">
                    {article.title}
                    {article.url && (
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                  </h6>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{article.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

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
        {renderContent()}
      </div>
    </div>
  )
}
