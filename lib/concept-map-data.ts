import { databaseService } from "./database/database-service"

export interface ConceptNode {
  id: string
  label: string
  type: "concept" | "article" | "person" | "organization" | "technology" | "methodology"
  density: number // 0-100, affects node size and color
  articles: string[] // article IDs that mention this concept
  description?: string
  source: "analyzed" | "mock" // Track where the concept came from
  frequency: number // Raw frequency count
}

export interface ConceptEdge {
  id: string
  source: string
  target: string
  type: "mentions" | "relates_to" | "co_occurs"
  weight: number // 0-1, affects edge thickness
}

export interface ConceptMapData {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
}

// Get filtered data based on abstraction level and search
export function getConceptMapData(abstractionLevel = 50, searchQuery = ""): ConceptMapData {
  console.log("Getting concept map data with abstraction:", abstractionLevel, "search:", searchQuery)

  try {
    // Get data from the database service
    const dbData = databaseService.getConceptMapData(abstractionLevel, searchQuery)

    if (!dbData) {
      console.warn("Database service returned null/undefined data")
      return { nodes: [], edges: [] }
    }

    console.log("Database returned:", dbData.nodes?.length || 0, "nodes and", dbData.edges?.length || 0, "edges")

    // Convert database format to concept map format with validation
    const nodes: ConceptNode[] = (dbData.nodes || []).map((node) => ({
      id: node.id || `node-${Math.random()}`,
      label: node.label || node.name || "Unknown",
      type: (node.type as ConceptNode["type"]) || "concept",
      density: Math.max(0, Math.min(100, node.density || 0)),
      articles: Array.isArray(node.articles) ? node.articles : [],
      description: node.description || "",
      source: "analyzed" as const, // Only analyzed data now
      frequency: node.frequency || 0,
    }))

    const edges: ConceptEdge[] = (dbData.edges || []).map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.source || "",
      target: edge.target || "",
      type: (edge.type as ConceptEdge["type"]) || "relates_to",
      weight: Math.max(0, Math.min(1, edge.weight || 0.5)),
    }))

    // Filter out invalid edges (missing source or target)
    const validEdges = edges.filter(
      (edge) =>
        edge.source &&
        edge.target &&
        nodes.some((n) => n.id === edge.source) &&
        nodes.some((n) => n.id === edge.target),
    )

    return { nodes, edges: validEdges }
  } catch (error) {
    console.error("Error getting concept map data from database:", error)

    // Return empty data instead of mock data
    console.log("Returning empty concept map data due to error")
    return { nodes: [], edges: [] }
  }
}

// Search concepts
export function searchConcepts(query: string): ConceptNode[] {
  try {
    const results = databaseService.searchConcepts(query)
    return results.map((concept) => ({
      id: concept.id,
      label: concept.name,
      type: concept.type as ConceptNode["type"],
      density: Math.min(100, concept.frequency * 10), // Convert frequency to density
      articles: [], // Will be populated if needed
      description: concept.description,
      source: "analyzed" as const,
      frequency: concept.frequency,
    }))
  } catch (error) {
    console.error("Error searching concepts:", error)
    return []
  }
}

// Get concept details for the sidebar
export function getConceptDetails(conceptId: string): {
  concept: ConceptNode | null
  relatedConcepts: ConceptNode[]
  articles: any[]
} {
  try {
    const details = databaseService.getConceptDetails(conceptId)

    if (!details.concept) {
      return { concept: null, relatedConcepts: [], articles: [] }
    }

    // Convert database concept to ConceptNode format
    const concept: ConceptNode = {
      id: details.concept.id,
      label: details.concept.name,
      type: details.concept.type as ConceptNode["type"],
      density: Math.min(100, details.concept.frequency * 10),
      articles: details.articles.map((a) => a.content.id),
      description: details.concept.description,
      source: "analyzed" as const,
      frequency: details.concept.frequency,
    }

    // Convert related concepts
    const relatedConcepts: ConceptNode[] = details.relatedConcepts.map((relatedConcept) => ({
      id: relatedConcept.id,
      label: relatedConcept.name,
      type: relatedConcept.type as ConceptNode["type"],
      density: Math.min(100, relatedConcept.frequency * 10),
      articles: [],
      description: relatedConcept.description,
      source: "analyzed" as const,
      frequency: relatedConcept.frequency,
    }))

    // Convert articles
    const articles = details.articles.map(({ content, analysis }) => ({
      id: content.id,
      title: content.title,
      summary: analysis.summary.sentence,
      url: content.url,
    }))

    return { concept, relatedConcepts, articles }
  } catch (error) {
    console.error("Error getting concept details:", error)
    return { concept: null, relatedConcepts: [], articles: [] }
  }
}

// Get trending concepts
export function getTrendingConcepts(timeframe: "weekly" | "monthly" | "quarterly") {
  try {
    return databaseService.getTrendingConcepts(timeframe)
  } catch (error) {
    console.error("Error getting trending concepts:", error)
    return []
  }
}
