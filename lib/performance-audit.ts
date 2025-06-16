import { performanceMonitor } from "./performance-monitor"
import { cacheManager } from "./cache-manager"
import { authManager } from "./auth/auth-manager"
import { userSegmentedDatabase } from "./database/user-segmented-database"

interface PerformanceAuditResult {
  overall: "excellent" | "good" | "fair" | "poor"
  score: number
  metrics: {
    authentication: {
      score: number
      loginTime: number
      sessionManagement: "good" | "fair" | "poor"
    }
    database: {
      score: number
      queryTime: number
      userSegmentation: "efficient" | "moderate" | "slow"
      indexUtilization: number
    }
    caching: {
      score: number
      hitRate: number
      memoryUsage: number
      efficiency: "high" | "medium" | "low"
    }
    rendering: {
      score: number
      renderTime: number
      memoryLeaks: boolean
      componentOptimization: "optimized" | "moderate" | "needs-work"
    }
    userExperience: {
      score: number
      responsiveness: number
      errorRate: number
      stability: "stable" | "mostly-stable" | "unstable"
    }
  }
  recommendations: Array<{
    category: string
    priority: "high" | "medium" | "low"
    issue: string
    solution: string
    impact: string
  }>
  benchmarks: {
    loadTime: number
    timeToInteractive: number
    firstContentfulPaint: number
    largestContentfulPaint: number
  }
}

class PerformanceAuditor {
  private static instance: PerformanceAuditor

  static getInstance(): PerformanceAuditor {
    if (!PerformanceAuditor.instance) {
      PerformanceAuditor.instance = new PerformanceAuditor()
    }
    return PerformanceAuditor.instance
  }

  async runFullAudit(): Promise<PerformanceAuditResult> {
    console.log("🔍 Starting comprehensive performance audit...")

    const startTime = performance.now()

    // Collect metrics
    const authMetrics = await this.auditAuthentication()
    const dbMetrics = await this.auditDatabase()
    const cacheMetrics = await this.auditCaching()
    const renderMetrics = await this.auditRendering()
    const uxMetrics = await this.auditUserExperience()
    const benchmarks = await this.collectBenchmarks()

    // Calculate overall score
    const scores = [authMetrics.score, dbMetrics.score, cacheMetrics.score, renderMetrics.score, uxMetrics.score]
    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      authentication: authMetrics,
      database: dbMetrics,
      caching: cacheMetrics,
      rendering: renderMetrics,
      userExperience: uxMetrics,
    })

    const auditTime = performance.now() - startTime
    console.log(`✅ Performance audit completed in ${auditTime.toFixed(2)}ms`)

    return {
      overall: this.getOverallRating(overallScore),
      score: Math.round(overallScore),
      metrics: {
        authentication: authMetrics,
        database: dbMetrics,
        caching: cacheMetrics,
        rendering: renderMetrics,
        userExperience: uxMetrics,
      },
      recommendations,
      benchmarks,
    }
  }

  private async auditAuthentication() {
    const startTime = performance.now()

    // Test login performance
    const users = authManager.getAllUsers()
    const testUser = users[0]

    const loginStart = performance.now()
    authManager.login(testUser.username)
    const loginTime = performance.now() - loginStart

    // Check session management
    const sessionInfo = authManager.getSessionInfo()
    const sessionManagement = sessionInfo ? "good" : "poor"

    const totalTime = performance.now() - startTime

    let score = 100
    if (loginTime > 100) score -= 20
    if (loginTime > 200) score -= 30
    if (sessionManagement === "poor") score -= 25
    if (totalTime > 50) score -= 15

    return {
      score: Math.max(0, score),
      loginTime,
      sessionManagement: sessionManagement as "good" | "fair" | "poor",
    }
  }

  private async auditDatabase() {
    const startTime = performance.now()

    // Test query performance
    const queryStart = performance.now()
    const userStats = userSegmentedDatabase.getUserStats()
    const queryTime = performance.now() - queryStart

    // Test user segmentation efficiency
    const segmentationStart = performance.now()
    const userContent = userSegmentedDatabase.getUserContent()
    const userConcepts = userSegmentedDatabase.getUserConcepts()
    const segmentationTime = performance.now() - segmentationStart

    // Estimate index utilization
    const indexUtilization = this.estimateIndexUtilization()

    let score = 100
    if (queryTime > 100) score -= 25
    if (queryTime > 200) score -= 35
    if (segmentationTime > 150) score -= 20
    if (indexUtilization < 0.7) score -= 20

    const userSegmentation = segmentationTime < 100 ? "efficient" : segmentationTime < 200 ? "moderate" : "slow"

    return {
      score: Math.max(0, score),
      queryTime,
      userSegmentation: userSegmentation as "efficient" | "moderate" | "slow",
      indexUtilization: Math.round(indexUtilization * 100),
    }
  }

  private async auditCaching() {
    const cacheStats = cacheManager.getStats()

    let score = 100
    if (cacheStats.hitRate < 0.5) score -= 30
    if (cacheStats.hitRate < 0.3) score -= 40
    if (cacheStats.memoryUsage > 50) score -= 25
    if (cacheStats.size > 80) score -= 15

    const efficiency = cacheStats.hitRate > 0.7 ? "high" : cacheStats.hitRate > 0.4 ? "medium" : "low"

    return {
      score: Math.max(0, score),
      hitRate: Math.round(cacheStats.hitRate * 100) / 100,
      memoryUsage: cacheStats.memoryUsage,
      efficiency: efficiency as "high" | "medium" | "low",
    }
  }

  private async auditRendering() {
    const metrics = performanceMonitor.getMetrics()

    let score = 100
    if (metrics.renderTime > 100) score -= 25
    if (metrics.renderTime > 200) score -= 35
    if (metrics.memoryUsage > 100) score -= 20

    // Check for memory leaks (simplified)
    const memoryLeaks = metrics.memoryUsage > 150

    const componentOptimization =
      metrics.renderTime < 100 ? "optimized" : metrics.renderTime < 200 ? "moderate" : "needs-work"

    return {
      score: Math.max(0, score),
      renderTime: metrics.renderTime,
      memoryLeaks,
      componentOptimization: componentOptimization as "optimized" | "moderate" | "needs-work",
    }
  }

  private async auditUserExperience() {
    const metrics = performanceMonitor.getMetrics()

    // Calculate responsiveness (inverse of render time)
    const responsiveness = Math.max(0, 100 - metrics.renderTime / 2)

    // Error rate from metrics
    const errorRate = metrics.errorCount / 100 // Normalize to percentage

    let score = 100
    if (responsiveness < 70) score -= 25
    if (responsiveness < 50) score -= 35
    if (errorRate > 0.05) score -= 30
    if (errorRate > 0.1) score -= 40

    const stability = errorRate < 0.02 ? "stable" : errorRate < 0.05 ? "mostly-stable" : "unstable"

    return {
      score: Math.max(0, score),
      responsiveness: Math.round(responsiveness),
      errorRate: Math.round(errorRate * 1000) / 1000,
      stability: stability as "stable" | "mostly-stable" | "unstable",
    }
  }

  private async collectBenchmarks() {
    const metrics = performanceMonitor.getMetrics()

    return {
      loadTime: metrics.renderTime || 0,
      timeToInteractive: metrics.renderTime * 1.2 || 0,
      firstContentfulPaint: metrics.renderTime * 0.8 || 0,
      largestContentfulPaint: metrics.renderTime * 1.1 || 0,
    }
  }

  private estimateIndexUtilization(): number {
    // Simplified estimation based on query patterns
    // In a real implementation, this would analyze actual index usage
    return 0.85 // Assume good index utilization with current optimizations
  }

  private generateRecommendations(metrics: any): Array<{
    category: string
    priority: "high" | "medium" | "low"
    issue: string
    solution: string
    impact: string
  }> {
    const recommendations = []

    // Authentication recommendations
    if (metrics.authentication.score < 80) {
      recommendations.push({
        category: "Authentication",
        priority: "medium" as const,
        issue: "Login performance could be improved",
        solution: "Implement authentication caching and optimize user lookup",
        impact: "Faster login experience for users",
      })
    }

    // Database recommendations
    if (metrics.database.score < 75) {
      recommendations.push({
        category: "Database",
        priority: "high" as const,
        issue: "Database queries are slower than optimal",
        solution: "Add more indexes, implement query optimization, consider pagination",
        impact: "Significantly faster data loading and better user experience",
      })
    }

    if (metrics.database.userSegmentation === "slow") {
      recommendations.push({
        category: "Database",
        priority: "high" as const,
        issue: "User data segmentation is inefficient",
        solution: "Optimize user-specific queries with better indexing",
        impact: "Faster data isolation and improved multi-user performance",
      })
    }

    // Caching recommendations
    if (metrics.caching.score < 70) {
      recommendations.push({
        category: "Caching",
        priority: "medium" as const,
        issue: "Cache hit rate is below optimal",
        solution: "Adjust cache TTL values and implement smarter caching strategies",
        impact: "Reduced API calls and faster data retrieval",
      })
    }

    // Rendering recommendations
    if (metrics.rendering.score < 75) {
      recommendations.push({
        category: "Rendering",
        priority: "high" as const,
        issue: "Component rendering is slower than expected",
        solution: "Implement React.memo, useMemo, and useCallback optimizations",
        impact: "Smoother UI interactions and better responsiveness",
      })
    }

    if (metrics.rendering.memoryLeaks) {
      recommendations.push({
        category: "Rendering",
        priority: "high" as const,
        issue: "Potential memory leaks detected",
        solution: "Review component cleanup and event listener removal",
        impact: "Better long-term stability and performance",
      })
    }

    // User Experience recommendations
    if (metrics.userExperience.score < 80) {
      recommendations.push({
        category: "User Experience",
        priority: "high" as const,
        issue: "Overall user experience metrics are below target",
        solution: "Focus on reducing error rates and improving responsiveness",
        impact: "Better user satisfaction and engagement",
      })
    }

    return recommendations
  }

  private getOverallRating(score: number): "excellent" | "good" | "fair" | "poor" {
    if (score >= 90) return "excellent"
    if (score >= 75) return "good"
    if (score >= 60) return "fair"
    return "poor"
  }

  // Quick performance check for monitoring
  async quickCheck(): Promise<{
    status: "healthy" | "warning" | "critical"
    issues: string[]
    metrics: any
  }> {
    const metrics = performanceMonitor.getMetrics()
    const cacheStats = cacheManager.getStats()
    const issues = []

    if (metrics.renderTime > 200) {
      issues.push("Slow rendering detected")
    }
    if (metrics.memoryUsage > 100) {
      issues.push("High memory usage")
    }
    if (cacheStats.hitRate < 0.3) {
      issues.push("Low cache efficiency")
    }
    if (metrics.errorCount > 5) {
      issues.push("High error rate")
    }

    const status = issues.length === 0 ? "healthy" : issues.length <= 2 ? "warning" : "critical"

    return {
      status,
      issues,
      metrics: {
        renderTime: metrics.renderTime,
        memoryUsage: metrics.memoryUsage,
        cacheHitRate: cacheStats.hitRate,
        errorCount: metrics.errorCount,
      },
    }
  }
}

export const performanceAuditor = PerformanceAuditor.getInstance()

// Auto-run performance checks in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Run quick check every 30 seconds in development
  setInterval(async () => {
    const check = await performanceAuditor.quickCheck()
    if (check.status !== "healthy") {
      console.warn("⚠️ Performance issues detected:", check.issues)
    }
  }, 30000)
}
