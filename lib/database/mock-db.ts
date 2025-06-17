// Mock database that simulates production functionality for preview
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
  sentAt?: Date
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

// Mock database client
export const mockDb = {
  user: {
    create: async (data: Omit<User, "id" | "createdAt">) => {
      const user: User = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date(),
        digestFrequency: "WEEKLY",
        timezone: "UTC",
        ...data,
      }
      storage.users.set(user.id, user)
      return user
    },
    findByEmail: async (email: string) => {
      for (const user of storage.users.values()) {
        if (user.email === email) return user
      }
      return null
    },
    findById: async (id: string) => {
      return storage.users.get(id) || null
    },
    update: async (id: string, data: Partial<User>) => {
      const user = storage.users.get(id)
      if (user) {
        const updated = { ...user, ...data }
        storage.users.set(id, updated)
        return updated
      }
      throw new Error("User not found")
    },
  },
  content: {
    create: async (data: Omit<Content, "id" | "createdAt">) => {
      const content: Content = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date(),
        ...data,
      }
      storage.content.set(content.id, content)
      return content
    },
    findByUserId: async (userId: string) => {
      return Array.from(storage.content.values()).filter((c) => c.userId === userId)
    },
    findById: async (id: string) => {
      return storage.content.get(id) || null
    },
    delete: async (id: string) => {
      const deleted = storage.content.get(id)
      storage.content.delete(id)
      return deleted
    },
  },
  source: {
    create: async (data: Omit<Source, "id" | "createdAt">) => {
      const source: Source = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date(),
        isActive: true,
        ...data,
      }
      storage.sources.set(source.id, source)
      return source
    },
    findByUserId: async (userId: string) => {
      return Array.from(storage.sources.values()).filter((s) => s.userId === userId)
    },
    update: async (id: string, data: Partial<Source>) => {
      const source = storage.sources.get(id)
      if (source) {
        const updated = { ...source, ...data }
        storage.sources.set(id, updated)
        return updated
      }
      throw new Error("Source not found")
    },
    delete: async (id: string) => {
      const deleted = storage.sources.get(id)
      storage.sources.delete(id)
      return deleted
    },
  },
  concept: {
    findByUserId: async (userId: string) => {
      return Array.from(storage.concepts.values()).filter((c) => c.userId === userId)
    },
  },
  digest: {
    findByUserId: async (userId: string) => {
      return Array.from(storage.digests.values()).filter((d) => d.userId === userId)
    },
  },
}

// Initialize with sample data
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
    mockDb.source.create(source)
  })

  // Sample content
  const sampleContent: Omit<Content, "id" | "createdAt">[] = [
    {
      userId,
      title: "The Future of AI in Software Development",
      url: "https://example.com/ai-future",
      content:
        "Artificial intelligence is revolutionizing how we write, test, and deploy software. From code generation to automated testing, AI tools are becoming indispensable for modern developers.",
      source: "TechCrunch",
      hash: "hash1",
    },
    {
      userId,
      title: "Understanding Large Language Models",
      url: "https://example.com/llm-guide",
      content:
        "Large Language Models have transformed natural language processing. This comprehensive guide explores how LLMs work, their applications, and their impact on various industries.",
      source: "Stratechery",
      hash: "hash2",
    },
    {
      userId,
      title: "The Rise of Edge Computing",
      url: "https://example.com/edge-computing",
      content:
        "Edge computing is bringing computation closer to data sources. This shift is enabling real-time processing and reducing latency for critical applications.",
      source: "The Verge",
      hash: "hash3",
    },
  ]

  sampleContent.forEach((content) => {
    mockDb.content.create(content)
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
    {
      userId,
      name: "Edge Computing",
      type: "TECHNOLOGY",
      frequency: 6,
      description: "Distributed computing at the edge",
    },
    {
      userId,
      name: "Machine Learning",
      type: "TECHNOLOGY",
      frequency: 10,
      description: "ML algorithms and applications",
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
      content:
        "This week's highlights in AI and technology include major breakthroughs in large language models, new developments in edge computing, and innovative applications of machine learning in software development. Key trends show increasing adoption of AI tools in development workflows and growing interest in distributed computing architectures.",
      contentIds: [],
      status: "SENT",
      sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      userId,
      type: "WEEKLY",
      title: "Technology Trends Weekly Summary",
      content:
        "Recent developments in the tech industry focus on the convergence of AI and traditional software engineering practices. Notable advances include improved code generation tools, enhanced testing automation, and the emergence of AI-powered development environments.",
      contentIds: [],
      status: "SENT",
      sentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
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
