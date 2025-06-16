// Database schema definitions for Pensive
export interface ContentEntity {
  id: string
  title: string
  url: string
  content: string
  createdAt: string
  updatedAt: string
  source: string
  hash: string // Content hash for deduplication
}

export interface AnalysisEntity {
  id: string
  contentId: string
  summary: {
    sentence: string
    paragraph: string
    isFullRead: boolean
  }
  entities: ConceptEntity[]
  relationships: RelationshipEntity[]
  tags: string[]
  priority: "skim" | "read" | "deep-dive"
  fullContent?: string
  confidence: number // AI confidence score
  createdAt: string
}

export interface ConceptEntity {
  id: string
  name: string
  type: "concept" | "person" | "organization" | "technology" | "methodology"
  description?: string
  createdAt: string
  updatedAt: string
  frequency: number // How often this concept appears
}

export interface RelationshipEntity {
  id: string
  fromConceptId: string
  toConceptId: string
  type: "INCLUDES" | "RELATES_TO" | "IMPLEMENTS" | "USES" | "COMPETES_WITH"
  strength: number // 0-1
  contentId: string // Which content created this relationship
  createdAt: string
}

export interface FeedEntity {
  id: string
  url: string
  title: string
  description: string
  isActive: boolean
  fetchInterval: number
  lastFetched: string
  lastItemDate: string
  itemCount: number
  errorCount: number
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface DigestEntity {
  id: string
  timeframe: "weekly" | "monthly" | "quarterly"
  title: string
  summary: string
  contentIds: string[]
  trendingConcepts: Array<{
    conceptId: string
    reason: string
    importance: string
    trendType: string
  }>
  stats: {
    totalArticles: number
    deepDiveCount: number
    readCount: number
    skimCount: number
  }
  createdAt: string
}

// Database indexes for faster queries
export interface DatabaseIndex {
  [key: string]: Map<string, Set<string>> // field -> value -> entity IDs
}

export type EntityType = ContentEntity | AnalysisEntity | ConceptEntity | RelationshipEntity | FeedEntity | DigestEntity

export type TableName = "content" | "analysis" | "concepts" | "relationships" | "feeds" | "digests"
