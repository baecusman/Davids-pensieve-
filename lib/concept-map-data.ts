import { databaseService } from "./database/database-service"
import type { ConceptEntity } from "./database/schema"

export interface ConceptNode {
  id: string
  label: string
  type: "concept" | "article" | "person" | "organization" | "technology" | "methodology"
  density: number // 0-100, affects node size and color
  articles: string[] // article IDs that mention this concept
  description?: string
  source: "analyzed" // Source is always 'analyzed' now
  frequency: number // Raw frequency count
}

export interface ConceptEdge {
  id: string
  source: string
  target: string
  type: "mentions" | "relates_to" | "co_occurs" // Ensure these types align with RelationshipEntity["type"] or mapping is done
  weight: number // 0-1, affects edge thickness
}

export interface ConceptMapData {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
}

// Get filtered data based on abstraction level and search
export async function getConceptMapData(abstractionLevel = 50, searchQuery = ""): Promise<ConceptMapData> {
  console.log("Getting concept map data with abstraction:", abstractionLevel, "search:", searchQuery)

  try {
    // Get data from the database service
    const dbData = await databaseService.getConceptMapData(abstractionLevel, searchQuery)

    if (!dbData) {
      console.warn("Database service returned null/undefined data")
      return { nodes: [], edges: [] }
    }

    console.log("Database returned:", dbData.nodes?.length || 0, "nodes and", dbData.edges?.length || 0, "edges")

    // Convert database format to concept map format with validation
    const nodes: ConceptNode[] = (dbData.nodes || []).map((node) => ({
      id: node.id || `node-${Math.random()}`,
      label: node.label || (node as any).name || "Unknown", // dbData node might have name property
      type: (node.type as ConceptNode["type"]) || "concept",
      density: Math.max(0, Math.min(100, node.density || 0)),
      articles: Array.isArray((node as any).articles) ? (node as any).articles : [],
      description: node.description || "",
      source: "analyzed" as const,
      frequency: node.frequency || 0,
    }))

    const edges: ConceptEdge[] = (dbData.edges || []).map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.source || "",
      target: edge.target || "",
      type: (edge.type as ConceptEdge["type"]) || "relates_to", // Ensure this cast is valid
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
    console.log("Returning empty concept map data due to error")
    return { nodes: [], edges: [] }
  }
}

// Search concepts
export async function searchConcepts(query: string): Promise<ConceptNode[]> {
  try {
    const results: ConceptEntity[] = await databaseService.searchConcepts(query) // Type annotation for results
    return results.map((concept) => ({
      id: concept.id,
      label: concept.name,
      type: concept.type as ConceptNode["type"], // Cast, ensure ConceptEntity.type is compatible
      density: Math.min(100, (concept.frequency || 0) * 10), // Ensure frequency exists
      articles: [], // Placeholder, adapt if articles are needed here
      description: concept.description,
      source: "analyzed" as const,
      frequency: concept.frequency || 0, // Ensure frequency exists
    }))
  } catch (error) {
    console.error("Error searching concepts:", error)
    return []
  }
}

// Get concept details for the sidebar
export async function getConceptDetails(conceptId: string): Promise<{
  concept: ConceptNode | null
  relatedConcepts: ConceptNode[]
  articles: any[] // Consider defining a more specific type for articles
}> {
  try {
    const details = await databaseService.getConceptDetails(conceptId)

    if (!details || !details.concept) { // Check details itself as well
      return { concept: null, relatedConcepts: [], articles: [] }
    }

    // Convert database concept to ConceptNode format
    const concept: ConceptNode = {
      id: details.concept.id,
      label: details.concept.name,
      type: details.concept.type as ConceptNode["type"],
      density: Math.min(100, (details.concept.frequency || 0) * 10),
      articles: details.articles ? details.articles.map((a: any) => a.content?.id).filter(id => id) : [], // Add checks for content and id
      description: details.concept.description,
      source: "analyzed" as const,
      frequency: details.concept.frequency || 0,
    }

    // Convert related concepts
    const relatedConcepts: ConceptNode[] = (details.relatedConcepts || []).map((relatedConcept) => ({
      id: relatedConcept.id,
      label: relatedConcept.name,
      type: relatedConcept.type as ConceptNode["type"],
      density: Math.min(100, (relatedConcept.frequency || 0) * 10),
      articles: [], // Placeholder
      description: relatedConcept.description,
      source: "analyzed" as const,
      frequency: relatedConcept.frequency || 0,
    }))

    // Convert articles
    const articles = (details.articles || []).map(({ content, analysis }: { content: ContentEntity, analysis: AnalysisEntity | null }) => ({
      id: content?.id, // Add safe access
      title: content?.title, // Add safe access
      summary: analysis?.summary?.sentence, // Add safe access
      url: content?.url, // Add safe access
    })).filter(article => article.id); // Filter out articles that might be malformed

    return { concept, relatedConcepts, articles }
  } catch (error) {
    console.error("Error getting concept details:", error)
    return { concept: null, relatedConcepts: [], articles: [] }
  }
}

// Get trending concepts
export async function getTrendingConcepts(timeframe: "weekly" | "monthly" | "quarterly") {
  try {
    // Assuming getTrendingConcepts returns the correct type directly or needs mapping
    return await databaseService.getTrendingConcepts(timeframe)
  } catch (error) {
    console.error("Error getting trending concepts:", error)
    return [] // Return empty array or handle error as appropriate
  }
}
