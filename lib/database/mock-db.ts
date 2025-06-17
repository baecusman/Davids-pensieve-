// Mock database that simulates Prisma functionality for preview
export interface User {
  id: string
  email: string
  name?: string
  createdAt: Date
  digestFrequency: string
  timezone: string
}

export interface Content {
  id: string
  userId: string
  title: string
  url?: string
  content: string
  source: string
  hash: string
  createdAt: Date
}

export interface Analysis {
  id: string
  userId: string
  contentId: string
  summary: any
  entities: any
  tags: string[]
  priority: "SKIM" | "READ" | "DEEP_DIVE"
  confidence: number
  createdAt: Date
}

export interface Concept {
  id: string
  userId: string
  name: string
  type: string
  frequency: number
  description?: string
  createdAt: Date
}

export interface Source {
  id: string
  userId: string
  name: string
  url: string
  type: "RSS" | "PODCAST" | "TWITTER" | "MANUAL"
  isActive: boolean
  lastFetched?: Date
  createdAt: Date
}

export interface Digest {
  id: string
  userId: string
  type: "WEEKLY" | "MONTHLY" | "QUARTERLY"
  title: string
  content: string
  contentIds: string[]
  status: "DRAFT" | "SCHEDULED" | "SENT" | "FAILED"
  createdAt: Date
}

// In-memory storage for preview
const storage = {
  users: new Map<string, User>(),
  content: new Map<string, Content>(),
  analyses: new Map<string, Analysis>(),
  concepts: new Map<string, Concept>(),
  sources: new Map<string, Source>(),
  digests: new Map<string, Digest>(),
}

// Mock Prisma client
export const mockPrisma = {
  user: {
    create: async (data: { data: Omit<User, "id" | "createdAt"> }) => {
      const user: User = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date(),
        digestFrequency: "WEEKLY",
        timezone: "UTC",
        ...data.data,
      }
      storage.users.set(user.id, user)
      return user
    },
    findUnique: async (query: { where: { id?: string; email?: string } }) => {
      if (query.where.id) {
        return storage.users.get(query.where.id) || null
      }
      if (query.where.email) {
        for (const user of storage.users.values()) {
          if (user.email === query.where.email) return user
        }
      }
      return null
    },
    update: async (data: { where: { id: string }; data: Partial<User> }) => {
      const user = storage.users.get(data.where.id)
      if (user) {
        const updated = { ...user, ...data.data }
        storage.users.set(user.id, updated)
        return updated
      }
      throw new Error("User not found")
    },
  },
  content: {
    create: async (data: { data: Omit<Content, "id" | "createdAt"> }) => {
      const content: Content = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date(),
        ...data.data,
      }
      storage.content.set(content.id, content)
      return content
    },
    findMany: async (query?: { where?: { userId?: string } }) => {
      const results = Array.from(storage.content.values())
      if (query?.where?.userId) {
        return results.filter((c) => c.userId === query.where.userId)
      }
      return results
    },
    findUnique: async (query: { where: { id: string } }) => {
      return storage.content.get(query.where.id) || null
    },
  },
  source: {
    create: async (data: { data: Omit<Source, "id" | "createdAt"> }) => {
      const source: Source = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date(),
        isActive: true,
        ...data.data,
      }
      storage.sources.set(source.id, source)
      return source
    },
    findMany: async (query?: { where?: { userId?: string } }) => {
      const results = Array.from(storage.sources.values())
      if (query?.where?.userId) {
        return results.filter((s) => s.userId === query.where.userId)
      }
      return results
    },
    update: async (data: { where: { id: string }; data: Partial<Source> }) => {
      const source = storage.sources.get(data.where.id)
      if (source) {
        const updated = { ...source, ...data.data }
        storage.sources.set(source.id, updated)
        return updated
      }
      throw new Error("Source not found")
    },
    delete: async (query: { where: { id: string } }) => {
      const deleted = storage.sources.get(query.where.id)
      storage.sources.delete(query.where.id)
      return deleted
    },
  },
  concept: {
    findMany: async (query?: { where?: { userId?: string } }) => {
      const results = Array.from(storage.concepts.values())
      if (query?.where?.userId) {
        return results.filter((c) => c.userId === query.where.userId)
      }
      return results
    },
  },
  digest: {
    findMany: async (query?: { where?: { userId?: string } }) => {
      const results = Array.from(storage.digests.values())
      if (query?.where?.userId) {
        return results.filter((d) => d.userId === query.where.userId)
      }
      return results
    },
  },
}

// Initialize with some sample data
export const initializeSampleData = (userId: string) => {
  // Sample sources
  const sampleSources: Omit<Source, "id" | "createdAt">[] = [
    {
      userId,
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      type: "RSS",
      isActive: true,
    },
    {
      userId,
      name: "Stratechery",
      url: "https://stratechery.com/feed/",
      type: "RSS",
      isActive: true,
    },
    {
      userId,
      name: "The Verge",
      url: "https://www.theverge.com/rss/index.xml",
      type: "RSS",
      isActive: true,
    },
  ]

  sampleSources.forEach((source) => {
    mockPrisma.source.create({ data: source })
  })

  // Sample content
  const sampleContent: Omit<Content, "id" | "createdAt">[] = [
    {
      userId,
      title: "The Future of AI in Software Development",
      url: "https://example.com/ai-future",
      content: "Artificial intelligence is revolutionizing how we write, test, and deploy software...",
      source: "TechCrunch",
      hash: "hash1",
    },
    {
      userId,
      title: "Understanding Large Language Models",
      url: "https://example.com/llm-guide",
      content: "Large Language Models have transformed natural language processing...",
      source: "Stratechery",
      hash: "hash2",
    },
  ]

  sampleContent.forEach((content) => {
    mockPrisma.content.create({ data: content })
  })

  // Sample concepts
  const sampleConcepts: Omit<Concept, "id" | "createdAt">[] = [
    {
      userId,
      name: "Artificial Intelligence",
      type: "TECHNOLOGY",
      frequency: 15,
      description: "AI and machine learning technologies",
    },
    {
      userId,
      name: "Software Development",
      type: "METHODOLOGY",
      frequency: 12,
      description: "Programming and development practices",
    },
    {
      userId,
      name: "Large Language Models",
      type: "TECHNOLOGY",
      frequency: 8,
      description: "LLMs like GPT, Claude, etc.",
    },
  ]

  sampleConcepts.forEach((concept) => {
    const conceptData: Concept = {
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      ...concept,
    }
    storage.concepts.set(conceptData.id, conceptData)
  })

  // Sample digests
  const sampleDigests: Omit<Digest, "id" | "createdAt">[] = [
    {
      userId,
      type: "WEEKLY",
      title: "Weekly AI & Tech Digest",
      content: "This week's highlights in AI and technology...",
      contentIds: [],
      status: "SENT",
    },
  ]

  sampleDigests.forEach((digest) => {
    const digestData: Digest = {
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      ...digest,
    }
    storage.digests.set(digestData.id, digestData)
  })
}
