interface PerformanceMetrics {
  renderTime: number
  dbQueryTime: number
  apiResponseTime: number
  memoryUsage: number
  errorCount: number
  lastUpdated: string
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    dbQueryTime: 0,
    apiResponseTime: 0,
    memoryUsage: 0,
    errorCount: 0,
    lastUpdated: new Date().toISOString(),
  }
  private observers: Map<string, PerformanceObserver> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  constructor() {
    this.initializeObservers()
  }

  private initializeObservers(): void {
    if (typeof window === "undefined") return

    try {
      // Monitor paint timing
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.name === "first-contentful-paint") {
            this.metrics.renderTime = entry.startTime
          }
        })
      })
      paintObserver.observe({ entryTypes: ["paint"] })
      this.observers.set("paint", paintObserver)

      // Monitor long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.duration > 50) {
            console.warn(`Long task detected: ${entry.duration}ms`)
          }
        })
      })
      longTaskObserver.observe({ entryTypes: ["longtask"] })
      this.observers.set("longtask", longTaskObserver)
    } catch (error) {
      console.warn("Performance observers not supported:", error)
    }
  }

  startTimer(operation: string): () => void {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.recordOperation(operation, duration)
    }
  }

  recordOperation(operation: string, duration: number): void {
    switch (operation) {
      case "db-query":
        this.metrics.dbQueryTime = duration
        break
      case "api-call":
        this.metrics.apiResponseTime = duration
        break
      case "render":
        this.metrics.renderTime = duration
        break
    }
    this.metrics.lastUpdated = new Date().toISOString()
  }

  recordError(): void {
    this.metrics.errorCount++
  }

  getMetrics(): PerformanceMetrics {
    if (typeof window !== "undefined" && (performance as any).memory) {
      this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
    }
    return { ...this.metrics }
  }

  cleanup(): void {
    this.observers.forEach((observer) => observer.disconnect())
    this.observers.clear()
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()
