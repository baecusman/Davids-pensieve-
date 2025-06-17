// Mock database implementation for preview
interface User {
  id: string
  email: string
  name: string
  digestFrequency: "WEEKLY" | "MONTHLY" | "NEVER"
  digestEmail?: string
  timezone: string
  createdAt: string
}

interface Content {
  id: string
  userId: string
  title: string
  url?: string
  content: string
  source: string
  hash: string
  createdAt: string
  updatedAt: string
}

interface Analysis {
  id: string
  userId: string
  contentId: string
  summary: {
    sentence: string
    paragraph: string
    isFullRead: boolean
  }
  entities: Array<{
    name: string
    type: string
  }>
  tags: string[]
  priority: "skim" | "read" | "deep_dive"
  confidence: number
  createdAt: string
}

interface Concept {
  id: string
  userId: string
  name: string
  type: string
  frequency: number
  description?: string
  createdAt: string
  updatedAt: string
}

interface Relationship {
  id: string
  userId: string
  fromConceptId: string
  toConceptId: string
  contentId: string
  type: string
  strength: number
  createdAt: string
}

interface Feed {
  id: string
  userId: string
  name: string
  url: string
  type: string
  isActive: boolean
  lastFetched?: string
  etag?: string
  lastModified?: string
  createdAt: string
  updatedAt: string
}

interface Digest {
  id: string
  userId: string
  type: "WEEKLY" | "MONTHLY" | "QUARTERLY"
  title: string
  content: string
  contentIds: string[]
  status: "DRAFT" | "SCHEDULED" | "SENT" | "FAILED"
  scheduledAt?: string
  sentAt?: string
  createdAt: string
}

class MockDatabase {
  private users: Map<string, User> = new Map()
  private content: Map<string, Content> = new Map()
  private analysis: Map<string, Analysis> = new Map()
  private concepts: Map<string, Concept> = new Map()
  private relationships: Map<string, Relationship> = new Map()
  private feeds: Map<string, Feed> = new Map()
  private digests: Map<string, Digest> = new Map()

  constructor() {
    this.initializeMockData()
  }

  private initializeMockData() {
    // Create a mock user
    const mockUser: User = {
      id: "mock-user-1",
      email: "demo@pensive.app",
      name: "Demo User",
      digestFrequency: "WEEKLY",
      digestEmail: "demo@pensive.app",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    }
    this.users.set(mockUser.id, mockUser)

    // Create mock content
    const mockContent: Content[] = [
      {
        id: "content-1",
        userId: mockUser.id,
        title: "The Future of AI in Software Development",
        url: "https://example.com/ai-software-dev",
        content:
          "Artificial intelligence is revolutionizing how we write, test, and deploy software. From code generation to automated testing, AI tools are becoming indispensable for modern developers.",
        source: "TechCrunch",
        hash: "hash-1",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "content-2",
        userId: mockUser.id,
        title: "Understanding Quantum Computing Basics",
        url: "https://example.com/quantum-computing",
        content:
          "Quantum computing represents a fundamental shift in computational paradigms. Unlike classical computers that use bits, quantum computers use quantum bits or qubits.",
        source: "MIT Technology Review",
        hash: "hash-2",
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: "content-3",
        userId: mockUser.id,
        title: "Sustainable Technology Trends 2024",
        url: "https://example.com/sustainable-tech",
        content:
          "Green technology is becoming increasingly important as companies focus on reducing their carbon footprint. From renewable energy to efficient data centers.",
        source: "Wired",
        hash: "hash-3",
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        updatedAt: new Date(Date.now() - 259200000).toISOString(),
      },
    ]

    mockContent.forEach((content) => this.content.set(content.id, content))

    // Create mock analysis
    const mockAnalysis: Analysis[] = [
      {
        id: "analysis-1",
        userId: mockUser.id,
        contentId: "content-1",
        summary: {
          sentence: "AI is transforming software development through automation and intelligent tooling.",
          paragraph:
            "This article explores how artificial intelligence is revolutionizing software development practices, from automated code generation to intelligent testing frameworks. The integration of AI tools is becoming essential for modern development workflows.",
          isFullRead: false,
        },
        entities: [
          { name: "Artificial Intelligence", type: "technology" },
          { name: "Software Development", type: "concept" },
          { name: "Code Generation", type: "methodology" },
          { name: "Automated Testing", type: "methodology" },
        ],
        tags: ["ai", "software", "development", "automation"],
        priority: "read",
        confidence: 0.9,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "analysis-2",
        userId: mockUser.id,
        contentId: "content-2",
        summary: {
          sentence: "Quantum computing uses qubits instead of classical bits for revolutionary computational power.",
          paragraph:
            "This piece provides an introduction to quantum computing fundamentals, explaining how qubits differ from classical bits and the potential applications of quantum systems in solving complex computational problems.",
          isFullRead: false,
        },
        entities: [
          { name: "Quantum Computing", type: "technology" },
          { name: "Qubits", type: "concept" },
          { name: "Classical Computing", type: "technology" },
          { name: "Computational Paradigms", type: "concept" },
        ],
        tags: ["quantum", "computing", "qubits", "technology"],
        priority: "deep_dive",
        confidence: 0.85,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: "analysis-3",
        userId: mockUser.id,
        contentId: "content-3",
        summary: {
          sentence: "Green technology trends focus on reducing carbon footprint through sustainable innovations.",
          paragraph:
            "The article discusses emerging sustainable technology trends for 2024, highlighting how companies are adopting green technologies to reduce environmental impact while maintaining operational efficiency.",
          isFullRead: false,
        },
        entities: [
          { name: "Green Technology", type: "concept" },
          { name: "Sustainability", type: "concept" },
          { name: "Carbon Footprint", type: "concept" },
          { name: "Renewable Energy", type: "technology" },
        ],
        tags: ["sustainability", "green-tech", "environment", "renewable"],
        priority: "read",
        confidence: 0.8,
        createdAt: new Date(Date.now() - 259200000).toISOString(),
      },
    ]

    mockAnalysis.forEach((analysis) => this.analysis.set(analysis.id, analysis))

    // Create mock concepts
    const mockConcepts: Concept[] = [
      {
        id: "concept-1",
        userId: mockUser.id,
        name: "Artificial Intelligence",
        type: "technology",
        frequency: 5,
        description: "AI and machine learning technologies",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "concept-2",
        userId: mockUser.id,
        name: "Software Development",
        type: "concept",
        frequency: 3,
        description: "Programming and software engineering practices",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "concept-3",
        userId: mockUser.id,
        name: "Quantum Computing",
        type: "technology",
        frequency: 2,
        description: "Quantum computational systems and algorithms",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "concept-4",
        userId: mockUser.id,
        name: "Sustainability",
        type: "concept",
        frequency: 4,
        description: "Environmental and sustainable technology practices",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    mockConcepts.forEach((concept) => this.concepts.set(concept.id, concept))

    // Create mock relationships
    const mockRelationships: Relationship[] = [
      {
        id: "rel-1",
        userId: mockUser.id,
        fromConceptId: "concept-1",
        toConceptId: "concept-2",
        contentId: "content-1",
        type: "RELATES_TO",
        strength: 0.8,
        createdAt: new Date().toISOString(),
      },
      {
        id: "rel-2",
        userId: mockUser.id,
        fromConceptId: "concept-3",
        toConceptId: "concept-1",
        contentId: "content-2",
        type: "RELATES_TO",
        strength: 0.6,
        createdAt: new Date().toISOString(),
      },
    ]

    mockRelationships.forEach((rel) => this.relationships.set(rel.id, rel))

    // Create mock feeds
    const mockFeeds: Feed[] = [
      {
        id: "feed-1",
        userId: mockUser.id,
        name: "TechCrunch",
        url: "https://techcrunch.com/feed/",
        type: "RSS",
        isActive: true,
        lastFetched: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "feed-2",
        userId: mockUser.id,
        name: "MIT Technology Review",
        url: "https://www.technologyreview.com/feed/",
        type: "RSS",
        isActive: true,
        lastFetched: new Date(Date.now() - 7200000).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ]

    mockFeeds.forEach((feed) => this.feeds.set(feed.id, feed))

    // Create mock digest
    const mockDigest: Digest = {
      id: "digest-1",
      userId: mockUser.id,
      type: "WEEKLY",
      title: "Your Weekly Digest",
      content: "<h1>Your Weekly Digest</h1><p>Here are the most important items from your recent reading...</p>",
      contentIds: ["content-1", "content-2", "content-3"],
      status: "SENT",
      scheduledAt: new Date(Date.now() - 86400000).toISOString(),
      sentAt: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    }

    this.digests.set(mockDigest.id, mockDigest)
  }

  // User methods
  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null
  }

  async createUser(userData: Omit<User, "id" | "createdAt">): Promise<User> {
    const user: User = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    this.users.set(user.id, user)
    return user
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id)
    if (!user) return null

    const updatedUser = { ...user, ...updates }
    this.users.set(id, updatedUser)
    return updatedUser
  }

  // Content methods
  async getContent(
    userId: string,
    options: {
      page?: number
      limit?: number
      source?: string
      priority?: string
      timeframe?: "weekly" | "monthly" | "quarterly"
    } = {},
  ): Promise<{
    items: Array<Content & { analysis?: Analysis }>
    total: number
    hasMore: boolean
    page: number
    totalPages: number
  }> {
    let userContent = Array.from(this.content.values()).filter((c) => c.userId === userId)

    // Apply filters
    if (options.source) {
      userContent = userContent.filter((c) => c.source === options.source)
    }

    if (options.timeframe) {
      const cutoff = this.getTimeframeCutoff(options.timeframe)
      userContent = userContent.filter((c) => new Date(c.createdAt) >= cutoff)
    }

    // Sort by creation date (newest first)
    userContent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Pagination
    const page = options.page || 1
    const limit = options.limit || 50
    const offset = (page - 1) * limit
    const paginatedContent = userContent.slice(offset, offset + limit)

    // Add analysis data
    const items = paginatedContent.map((content) => ({
      ...content,
      analysis: Array.from(this.analysis.values()).find((a) => a.contentId === content.id),
    }))

    return {
      items,
      total: userContent.length,
      hasMore: offset + limit < userContent.length,
      page,
      totalPages: Math.ceil(userContent.length / limit),
    }
  }

  async createContent(contentData: Omit<Content, "id" | "createdAt" | "updatedAt">): Promise<Content> {
    const content: Content = {
      ...contentData,
      id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.content.set(content.id, content)
    return content
  }

  // Analysis methods
  async createAnalysis(analysisData: Omit<Analysis, "id" | "createdAt">): Promise<Analysis> {
    const analysis: Analysis = {
      ...analysisData,
      id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    }
    this.analysis.set(analysis.id, analysis)
    return analysis
  }

  // Concept methods
  async getConcepts(
    userId: string,
    options: {
      search?: string
      minFrequency?: number
    } = {},
  ): Promise<Concept[]> {
    let userConcepts = Array.from(this.concepts.values()).filter((c) => c.userId === userId)

    if (options.search) {
      userConcepts = userConcepts.filter((c) => c.name.toLowerCase().includes(options.search!.toLowerCase()))
    }

    if (options.minFrequency) {
      userConcepts = userConcepts.filter((c) => c.frequency >= options.minFrequency!)
    }

    return userConcepts.sort((a, b) => b.frequency - a.frequency)
  }

  async getRelationships(userId: string, conceptIds?: string[]): Promise<Relationship[]> {
    let userRelationships = Array.from(this.relationships.values()).filter((r) => r.userId === userId)

    if (conceptIds) {
      userRelationships = userRelationships.filter(
        (r) => conceptIds.includes(r.fromConceptId) && conceptIds.includes(r.toConceptId),
      )
    }

    return userRelationships
  }

  // Feed methods
  async getFeeds(userId: string): Promise<Feed[]> {
    return Array.from(this.feeds.values())
      .filter((f) => f.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async createFeed(feedData: Omit<Feed, "id" | "createdAt" | "updatedAt">): Promise<Feed> {
    const feed: Feed = {
      ...feedData,
      id: `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.feeds.set(feed.id, feed)
    return feed
  }

  async updateFeed(id: string, updates: Partial<Feed>): Promise<Feed | null> {
    const feed = this.feeds.get(id)
    if (!feed) return null

    const updatedFeed = { ...feed, ...updates, updatedAt: new Date().toISOString() }
    this.feeds.set(id, updatedFeed)
    return updatedFeed
  }

  async deleteFeed(id: string): Promise<boolean> {
    return this.feeds.delete(id)
  }

  // Digest methods
  async getDigests(userId: string): Promise<Digest[]> {
    return Array.from(this.digests.values())
      .filter((d) => d.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async createDigest(digestData: Omit<Digest, "id" | "createdAt">): Promise<Digest> {
    const digest: Digest = {
      ...digestData,
      id: `digest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    }
    this.digests.set(digest.id, digest)
    return digest
  }

  // Utility methods
  private getTimeframeCutoff(timeframe: "weekly" | "monthly" | "quarterly"): Date {
    const now = new Date()
    const cutoff = new Date()

    switch (timeframe) {
      case "weekly":
        cutoff.setDate(now.getDate() - 7)
        break
      case "monthly":
        cutoff.setMonth(now.getMonth() - 1)
        break
      case "quarterly":
        cutoff.setMonth(now.getMonth() - 3)
        break
    }

    return cutoff
  }

  // Export all user data
  async exportUserData(userId: string): Promise<any> {
    const user = this.users.get(userId)
    const userContent = Array.from(this.content.values()).filter((c) => c.userId === userId)
    const userAnalysis = Array.from(this.analysis.values()).filter((a) => a.userId === userId)
    const userConcepts = Array.from(this.concepts.values()).filter((c) => c.userId === userId)
    const userRelationships = Array.from(this.relationships.values()).filter((r) => r.userId === userId)
    const userFeeds = Array.from(this.feeds.values()).filter((f) => f.userId === userId)
    const userDigests = Array.from(this.digests.values()).filter((d) => d.userId === userId)

    return {
      user,
      content: userContent,
      analysis: userAnalysis,
      concepts: userConcepts,
      relationships: userRelationships,
      feeds: userFeeds,
      digests: userDigests,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    }
  }
}

export const mockDb = new MockDatabase()
