import type {
  ContentEntity,
  AnalysisEntity,
  ConceptEntity,
  RelationshipEntity,
  DatabaseIndex,
  EntityType,
  TableName,
} from "./schema"

interface QueryOptions {
  where?: Record<string, any>
  orderBy?: { field: string; direction: "asc" | "desc" }
  limit?: number
  offset?: number
}

interface JoinOptions {
  table: TableName
  on: { left: string; right: string }
  type?: "inner" | "left" | "right"
}

class BrowserDatabase {
  private static instance: BrowserDatabase
  private isAvailable: boolean
  private tables: Map<TableName, Map<string, EntityType>> = new Map()
  private indexes: Map<TableName, DatabaseIndex> = new Map()
  private version = "1.0.0"
  private dbKey = "pensive-database"

  constructor() {
    this.isAvailable = this.checkStorage()
    this.initializeTables()
    this.loadDatabase()
    this.createIndexes()
  }

  static getInstance(): BrowserDatabase {
    if (!BrowserDatabase.instance) {
      BrowserDatabase.instance = new BrowserDatabase()
    }
    return BrowserDatabase.instance
  }

  private checkStorage(): boolean {
    try {
      const test = "__storage_test__"
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      console.warn("localStorage not available, using memory-only database")
      return false
    }
  }

  private initializeTables(): void {
    const tableNames: TableName[] = ["content", "analysis", "concepts", "relationships", "feeds", "digests"]
    tableNames.forEach((tableName) => {
      this.tables.set(tableName, new Map())
      this.indexes.set(tableName, {})
    })
  }

  private loadDatabase(): void {
    if (!this.isAvailable) return

    try {
      const stored = localStorage.getItem(this.dbKey)
      if (stored) {
        const data = JSON.parse(stored)

        // Load each table
        Object.entries(data.tables || {}).forEach(([tableName, entities]) => {
          const table = this.tables.get(tableName as TableName)
          if (table && Array.isArray(entities)) {
            entities.forEach((entity: any) => {
              table.set(entity.id, entity)
            })
          }
        })

        console.log(`Loaded database with ${this.getTotalRecords()} records`)
      }
    } catch (error) {
      console.error("Error loading database:", error)
    }
  }

  private saveDatabase(): void {
    if (!this.isAvailable) return

    try {
      const data = {
        version: this.version,
        timestamp: new Date().toISOString(),
        tables: {} as Record<string, any[]>,
      }

      // Convert Maps to arrays for serialization
      this.tables.forEach((table, tableName) => {
        data.tables[tableName] = Array.from(table.values())
      })

      localStorage.setItem(this.dbKey, JSON.stringify(data))
    } catch (error) {
      console.error("Error saving database:", error)
    }
  }

  private createIndexes(): void {
    // Create indexes for frequently queried fields
    this.createIndex("content", "source")
    this.createIndex("content", "createdAt")
    this.createIndex("analysis", "contentId")
    this.createIndex("analysis", "priority")
    this.createIndex("concepts", "type")
    this.createIndex("concepts", "name")
    this.createIndex("relationships", "fromConceptId")
    this.createIndex("relationships", "toConceptId")
    this.createIndex("relationships", "contentId")
    this.createIndex("feeds", "isActive")
  }

  private createIndex(tableName: TableName, field: string): void {
    const table = this.tables.get(tableName)
    const tableIndexes = this.indexes.get(tableName)

    if (!table || !tableIndexes) return

    if (!tableIndexes[field]) {
      tableIndexes[field] = new Map()
    }

    // Build index
    table.forEach((entity, id) => {
      const value = (entity as any)[field]
      if (value !== undefined) {
        const key = String(value)
        if (!tableIndexes[field].has(key)) {
          tableIndexes[field].set(key, new Set())
        }
        tableIndexes[field].get(key)!.add(id)
      }
    })
  }

  private updateIndex(tableName: TableName, field: string, oldValue: any, newValue: any, entityId: string): void {
    const tableIndexes = this.indexes.get(tableName)
    if (!tableIndexes || !tableIndexes[field]) return

    // Remove from old index
    if (oldValue !== undefined) {
      const oldKey = String(oldValue)
      const oldSet = tableIndexes[field].get(oldKey)
      if (oldSet) {
        oldSet.delete(entityId)
        if (oldSet.size === 0) {
          tableIndexes[field].delete(oldKey)
        }
      }
    }

    // Add to new index
    if (newValue !== undefined) {
      const newKey = String(newValue)
      if (!tableIndexes[field].has(newKey)) {
        tableIndexes[field].set(newKey, new Set())
      }
      tableIndexes[field].get(newKey)!.add(entityId)
    }
  }

  // CRUD Operations
  insert<T extends EntityType>(tableName: TableName, entity: T): string {
    const table = this.tables.get(tableName)
    if (!table) throw new Error(`Table ${tableName} not found`)

    const id = entity.id || this.generateId()
    const now = new Date().toISOString()

    const entityWithTimestamps = {
      ...entity,
      id,
      createdAt: entity.createdAt || now,
      updatedAt: now,
    } as T

    table.set(id, entityWithTimestamps)

    // Update indexes
    Object.keys(this.indexes.get(tableName) || {}).forEach((field) => {
      this.updateIndex(tableName, field, undefined, (entityWithTimestamps as any)[field], id)
    })

    this.saveDatabase()
    return id
  }

  update<T extends EntityType>(tableName: TableName, id: string, updates: Partial<T>): boolean {
    const table = this.tables.get(tableName)
    if (!table) return false

    const existing = table.get(id)
    if (!existing) return false

    const updated = {
      ...existing,
      ...updates,
      id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(),
    } as T

    // Update indexes
    Object.keys(this.indexes.get(tableName) || {}).forEach((field) => {
      if (field in updates) {
        this.updateIndex(tableName, field, (existing as any)[field], (updated as any)[field], id)
      }
    })

    table.set(id, updated)
    this.saveDatabase()
    return true
  }

  delete(tableName: TableName, id: string): boolean {
    const table = this.tables.get(tableName)
    if (!table) return false

    const existing = table.get(id)
    if (!existing) return false

    // Update indexes
    Object.keys(this.indexes.get(tableName) || {}).forEach((field) => {
      this.updateIndex(tableName, field, (existing as any)[field], undefined, id)
    })

    table.delete(id)
    this.saveDatabase()
    return true
  }

  findById<T extends EntityType>(tableName: TableName, id: string): T | null {
    const table = this.tables.get(tableName)
    return (table?.get(id) as T) || null
  }

  findAll<T extends EntityType>(tableName: TableName, options: QueryOptions = {}): T[] {
    const table = this.tables.get(tableName)
    if (!table) return []

    let results = Array.from(table.values()) as T[]

    // Apply WHERE clause
    if (options.where) {
      results = results.filter((entity) => {
        return Object.entries(options.where!).every(([field, value]) => {
          const entityValue = (entity as any)[field]
          if (Array.isArray(value)) {
            return value.includes(entityValue)
          }
          return entityValue === value
        })
      })
    }

    // Apply ORDER BY
    if (options.orderBy) {
      const { field, direction } = options.orderBy
      results.sort((a, b) => {
        const aVal = (a as any)[field]
        const bVal = (b as any)[field]

        if (aVal < bVal) return direction === "asc" ? -1 : 1
        if (aVal > bVal) return direction === "asc" ? 1 : -1
        return 0
      })
    }

    // Apply LIMIT and OFFSET
    if (options.offset) {
      results = results.slice(options.offset)
    }
    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  // Advanced query methods using indexes
  findByIndex<T extends EntityType>(tableName: TableName, field: string, value: any): T[] {
    const tableIndexes = this.indexes.get(tableName)
    const table = this.tables.get(tableName)

    if (!tableIndexes || !table || !tableIndexes[field]) {
      // Fallback to full table scan
      return this.findAll(tableName, { where: { [field]: value } })
    }

    const entityIds = tableIndexes[field].get(String(value))
    if (!entityIds) return []

    return Array.from(entityIds)
      .map((id) => table.get(id))
      .filter(Boolean) as T[]
  }

  // Join operations
  join<T extends EntityType, U extends EntityType>(
    leftTable: TableName,
    rightTable: TableName,
    joinOptions: JoinOptions,
    queryOptions: QueryOptions = {},
  ): Array<T & { joined?: U }> {
    const leftResults = this.findAll<T>(leftTable, queryOptions)
    const rightTableData = this.tables.get(rightTable)

    if (!rightTableData) return leftResults.map((item) => ({ ...item, joined: undefined }))

    return leftResults.map((leftItem) => {
      const joinValue = (leftItem as any)[joinOptions.on.left]
      const rightItem = Array.from(rightTableData.values()).find(
        (item) => (item as any)[joinOptions.on.right] === joinValue,
      ) as U

      return {
        ...leftItem,
        joined: rightItem,
      }
    })
  }

  // Search operations
  search<T extends EntityType>(tableName: TableName, searchTerm: string, fields: string[]): T[] {
    const table = this.tables.get(tableName)
    if (!table) return []

    const term = searchTerm.toLowerCase()
    return Array.from(table.values()).filter((entity) => {
      return fields.some((field) => {
        const value = (entity as any)[field]
        if (typeof value === "string") {
          return value.toLowerCase().includes(term)
        }
        if (Array.isArray(value)) {
          return value.some((item) => typeof item === "string" && item.toLowerCase().includes(term))
        }
        return false
      })
    }) as T[]
  }

  // Aggregation functions
  count(tableName: TableName, where?: Record<string, any>): number {
    return this.findAll(tableName, { where }).length
  }

  groupBy<T extends EntityType>(tableName: TableName, field: string): Map<string, T[]> {
    const results = this.findAll<T>(tableName)
    const groups = new Map<string, T[]>()

    results.forEach((item) => {
      const key = String((item as any)[field])
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(item)
    })

    return groups
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getTotalRecords(): number {
    let total = 0
    this.tables.forEach((table) => {
      total += table.size
    })
    return total
  }

  getTableStats(): Record<TableName, number> {
    const stats = {} as Record<TableName, number>
    this.tables.forEach((table, tableName) => {
      stats[tableName] = table.size
    })
    return stats
  }

  // Database maintenance
  vacuum(): void {
    // Remove orphaned relationships
    const relationships = this.findAll<RelationshipEntity>("relationships")
    const conceptIds = new Set(this.findAll<ConceptEntity>("concepts").map((c) => c.id))

    relationships.forEach((rel) => {
      if (!conceptIds.has(rel.fromConceptId) || !conceptIds.has(rel.toConceptId)) {
        this.delete("relationships", rel.id)
      }
    })

    // Remove orphaned analyses
    const analyses = this.findAll<AnalysisEntity>("analysis")
    const contentIds = new Set(this.findAll<ContentEntity>("content").map((c) => c.id))

    analyses.forEach((analysis) => {
      if (!contentIds.has(analysis.contentId)) {
        this.delete("analysis", analysis.id)
      }
    })

    console.log("Database vacuum completed")
  }

  backup(): string {
    const data = {
      version: this.version,
      timestamp: new Date().toISOString(),
      tables: {} as Record<string, any[]>,
    }

    this.tables.forEach((table, tableName) => {
      data.tables[tableName] = Array.from(table.values())
    })

    return JSON.stringify(data, null, 2)
  }

  restore(backup: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(backup)

      // Clear existing data
      this.tables.forEach((table) => table.clear())
      this.indexes.forEach((index) => {
        Object.keys(index).forEach((key) => {
          index[key].clear()
        })
      })

      // Load backup data
      Object.entries(data.tables || {}).forEach(([tableName, entities]) => {
        const table = this.tables.get(tableName as TableName)
        if (table && Array.isArray(entities)) {
          entities.forEach((entity: any) => {
            table.set(entity.id, entity)
          })
        }
      })

      // Rebuild indexes
      this.createIndexes()
      this.saveDatabase()

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  clear(): void {
    this.tables.forEach((table) => table.clear())
    this.indexes.forEach((index) => {
      Object.keys(index).forEach((key) => {
        index[key].clear()
      })
    })

    if (this.isAvailable) {
      localStorage.removeItem(this.dbKey)
    }
  }

  // Migration system
  migrate(fromVersion: string, toVersion: string): boolean {
    console.log(`Migrating database from ${fromVersion} to ${toVersion}`)
    // Add migration logic here as schema evolves
    return true
  }
}

export const browserDatabase = BrowserDatabase.getInstance()
