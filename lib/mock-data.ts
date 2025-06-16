// Mock data generators for demonstration purposes
// These provide sample data when no real content is available

interface DigestItem {
  title: string
  summary: string
  fullSummary?: string
  summaryType: "sentence" | "paragraph" | "full-read"
  priority: "skim" | "read" | "deep-dive"
  isNew?: boolean
  url: string
  conceptTags: string[]
  fullContent?: string
}

interface WeekData {
  weekStart: string
  weekEnd: string
  summary: string
  isCurrentWeek: boolean
  items: DigestItem[]
}

interface MonthData {
  month: string
  summary: string
  isCurrentMonth: boolean
  items: DigestItem[]
}

interface QuarterData {
  quarter: string
  summary: string
  isCurrentQuarter: boolean
  items: DigestItem[]
}

// Generate empty sample data - will be replaced by real content when available
export function generateWeeklyData(): WeekData[] {
  return []
}

export function generateMonthlyData(): MonthData[] {
  return []
}

export function generateQuarterlyData(): QuarterData[] {
  return []
}

// Legacy compatibility - these will be removed once all components are updated
export const mockWeeklyData: WeekData[] = []
export const mockMonthlyData: MonthData[] = []
export const mockQuarterlyData: QuarterData[] = []
