"use client"
import { useState, useEffect } from "react"
import {
  Download,
  Upload,
  Trash2,
  Database,
  Info,
  SettingsIcon,
  Activity,
  TrendingUp,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  HardDrive,
  Zap,
  Mail,
  Calendar,
} from "lucide-react"
import { databaseService } from "@/lib/database/database-service"
import { emailScheduler } from "@/lib/email-scheduler"
import { digestScheduler } from "@/lib/digest/digest-scheduler"
import { simpleAuth } from "@/lib/auth/simple-auth"

interface AppSettings {
  version: string
  preferences: {
    defaultAbstractionLevel: number
    autoAnalyze: boolean
    theme: "light" | "dark" | "auto"
    notifications: boolean
    autoBackup: boolean
    maxStorageSize: number // MB
  }
  performance: {
    enableCaching: boolean
    batchSize: number
    indexingEnabled: boolean
  }
  email: {
    enabled: boolean
    address: string
    digestSchedule: {
      frequency: "daily" | "weekly" | "monthly"
      time: string // HH:MM format
      timezone: string
      lastSent?: string
    }
  }
}

export default function SettingsView() {
  const [databaseStats, setDatabaseStats] = useState<any>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [healthCheck, setHealthCheck] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isVacuuming, setIsVacuuming] = useState(false)
  const [status, setStatus] = useState("")
  const [activeTab, setActiveTab] = useState<
    "overview" | "data" | "preferences" | "performance" | "maintenance" | "email"
  >("overview")

  const [digestEmail, setDigestEmail] = useState("")
  const [digestStatus, setDigestStatus] = useState<any>(null)

  useEffect(() => {
    loadData()
    performHealthCheck()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadData()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const stats = databaseService.getDatabaseStats()
      setDatabaseStats(stats)

      // Load settings from localStorage with defaults
      const storedSettings = localStorage.getItem("pensive-settings-v2")
      const defaultSettings: AppSettings = {
        version: "2.0.0",
        preferences: {
          defaultAbstractionLevel: 30,
          autoAnalyze: true,
          theme: "light",
          notifications: true,
          autoBackup: false,
          maxStorageSize: 100,
        },
        performance: {
          enableCaching: true,
          batchSize: 50,
          indexingEnabled: true,
        },
        email: {
          enabled: false,
          address: "",
          digestSchedule: {
            frequency: "weekly",
            time: "09:00",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
      }

      if (storedSettings) {
        const parsed = JSON.parse(storedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } else {
        setSettings(defaultSettings)
      }

      // Load digest settings
      const currentUser = simpleAuth.getCurrentUser()
      if (currentUser?.preferences?.digestEmail) {
        setDigestEmail(currentUser.preferences.digestEmail)
      }

      // Load digest status
      const status = digestScheduler.getUserDigestStatus(currentUser?.id || "")
      setDigestStatus(status)
    } catch (error) {
      console.error("Error loading data:", error)
      setStatus("❌ Error loading settings data")
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const performHealthCheck = async () => {
    try {
      const health = databaseService.healthCheck()
      setHealthCheck(health)
    } catch (error) {
      console.error("Health check failed:", error)
      setHealthCheck({
        status: "error",
        checks: {},
        stats: {},
        issues: ["Health check failed"],
      })
    }
  }

  const saveSettings = (newSettings: AppSettings) => {
    try {
      localStorage.setItem("pensive-settings-v2", JSON.stringify(newSettings))
      setSettings(newSettings)

      // Update email scheduler if email settings changed
      if (newSettings.email.enabled) {
        emailScheduler.updateSchedule(newSettings.email.digestSchedule)
      } else {
        emailScheduler.disable()
      }

      setStatus("✅ Settings saved")
      setTimeout(() => setStatus(""), 3000)
    } catch (error) {
      console.error("Error saving settings:", error)
      setStatus("❌ Error saving settings")
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const handleExport = async (format: string) => {
    setIsExporting(true)
    setStatus(`⏳ Exporting data to ${format.toUpperCase()}...`)

    try {
      const data = await databaseService.exportData(format)
      const filename = `pensive-data-${new Date().toISOString()}.${format}`

      // Create a download link
      const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setStatus(`✅ Data exported to ${filename}`)
    } catch (error) {
      console.error("Export error:", error)
      setStatus("❌ Export failed")
    } finally {
      setIsExporting(false)
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const handleImport = async (event: any) => {
    setIsImporting(true)
    setStatus("⏳ Importing data...")

    try {
      const file = event.target.files[0]
      if (!file) {
        setStatus("❌ No file selected")
        return
      }

      const reader = new FileReader()
      reader.onload = async (e: any) => {
        try {
          const jsonData = JSON.parse(e.target.result)
          await databaseService.importData(jsonData)
          setStatus("✅ Data imported successfully!")
          loadData() // Refresh data
        } catch (parseError) {
          console.error("JSON parsing error:", parseError)
          setStatus("❌ Error parsing JSON file")
        } finally {
          setIsImporting(false)
          setTimeout(() => setStatus(""), 3000)
        }
      }

      reader.readAsText(file)
    } catch (error) {
      console.error("Import error:", error)
      setStatus("❌ Import failed")
      setIsImporting(false)
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to delete all data? This action cannot be undone.")) {
      setStatus("⏳ Clearing all data...")
      try {
        await databaseService.clearAllData()
        setStatus("✅ All data cleared")
        loadData() // Refresh data
      } catch (error) {
        console.error("Clear all error:", error)
        setStatus("❌ Failed to clear all data")
      } finally {
        setTimeout(() => setStatus(""), 3000)
      }
    }
  }

  const handleVacuum = async () => {
    setIsVacuuming(true)
    setStatus("⏳ Cleaning database...")

    try {
      await databaseService.vacuumDatabase()
      setStatus("✅ Database cleaned")
      performHealthCheck() // Refresh health check
    } catch (error) {
      console.error("Vacuum error:", error)
      setStatus("❌ Failed to clean database")
    } finally {
      setIsVacuuming(false)
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const handleSaveDigestEmail = () => {
    if (!digestEmail) {
      setStatus("❌ Please enter an email address")
      setTimeout(() => setStatus(""), 3000)
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(digestEmail)) {
      setStatus("❌ Please enter a valid email address")
      setTimeout(() => setStatus(""), 3000)
      return
    }

    const currentUser = simpleAuth.getCurrentUser()
    if (!currentUser) {
      setStatus("❌ No user logged in")
      setTimeout(() => setStatus(""), 3000)
      return
    }

    console.log(`📧 Scheduling digest for user ${currentUser.username} at email ${digestEmail}`)

    // Update user email
    simpleAuth.updateUserEmail(digestEmail)

    // Schedule digest
    const success = digestScheduler.scheduleUserDigest(currentUser.id, digestEmail)

    if (success) {
      setStatus("✅ Weekly digest scheduled for Mondays at 4 AM ET")
      console.log("✅ Digest scheduling successful")
      loadData() // Refresh status
    } else {
      setStatus("❌ Failed to schedule digest")
      console.error("❌ Digest scheduling failed")
    }

    setTimeout(() => setStatus(""), 5000)
  }

  const handleUnscheduleDigest = () => {
    const currentUser = simpleAuth.getCurrentUser()
    if (!currentUser) return

    const success = digestScheduler.unscheduleUserDigest(currentUser.id)

    if (success) {
      setStatus("✅ Weekly digest unscheduled")
      setDigestStatus(null)
    } else {
      setStatus("❌ Failed to unschedule digest")
    }

    setTimeout(() => setStatus(""), 3000)
  }

  const handleTestDigest = async () => {
    if (!digestEmail) {
      setStatus("❌ Please enter an email address first")
      setTimeout(() => setStatus(""), 3000)
      return
    }

    const currentUser = simpleAuth.getCurrentUser()
    if (!currentUser) return

    try {
      setStatus("📧 Generating and sending test digest...")
      await digestScheduler.sendTestDigest(currentUser.id, digestEmail)
      setStatus("✅ Test digest sent successfully!")
      setTimeout(() => setStatus(""), 5000)
    } catch (error) {
      console.error("Test digest error:", error)
      setStatus("❌ Failed to send test digest")
      setTimeout(() => setStatus(""), 5000)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50 border-green-200"
      case "degraded":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case "error":
        return "text-red-600 bg-red-50 border-red-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />
      case "degraded":
        return <AlertTriangle className="h-4 w-4" />
      case "error":
        return <XCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  if (!databaseStats || !settings) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Settings & Analytics</h1>
        <p className="text-gray-600">Manage your Pensive system and monitor performance</p>
      </div>

      {/* Status Bar */}
      {status && (
        <div
          className={`mb-6 p-3 rounded-lg border ${
            status.includes("❌")
              ? "bg-red-50 border-red-200 text-red-800"
              : status.includes("✅")
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          {status}
        </div>
      )}

      {/* Health Status */}
      {healthCheck && (
        <div className={`mb-6 p-4 rounded-lg border ${getStatusColor(healthCheck.status)}`}>
          <div className="flex items-center gap-2 mb-2">
            {getStatusIcon(healthCheck.status)}
            <span className="font-medium capitalize">System Status: {healthCheck.status}</span>
          </div>
          {healthCheck.issues.length > 0 && (
            <ul className="text-sm mt-2 space-y-1">
              {healthCheck.issues.map((issue: string, index: number) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {[
              { id: "overview", label: "Overview", icon: Activity },
              { id: "data", label: "Data", icon: Database },
              { id: "preferences", label: "Preferences", icon: SettingsIcon },
              { id: "email", label: "Email", icon: Mail },
              { id: "performance", label: "Performance", icon: Zap },
              { id: "maintenance", label: "Maintenance", icon: HardDrive },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Total Content</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{databaseStats.content.totalContent}</div>
                  <div className="text-sm text-blue-700">{databaseStats.content.recentCount} this week</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">Concepts</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{databaseStats.concepts.totalConcepts}</div>
                  <div className="text-sm text-green-700">
                    Avg: {databaseStats.concepts.averageFrequency.toFixed(1)} mentions
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-900">Growth Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {databaseStats.content.growthRate > 0 ? "+" : ""}
                    {databaseStats.content.growthRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-700">vs last week</div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-900">Success Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {databaseStats.performance.successRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-orange-700">analysis success</div>
                </div>
              </div>

              {/* Top Sources */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Top Content Sources</h3>
                <div className="space-y-3">
                  {databaseStats.content.topSources.map((source: any, index: number) => (
                    <div key={source.source} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                          {index + 1}
                        </div>
                        <span className="font-medium">{source.source}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-600">{source.count} items</div>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${source.percentage}%` }} />
                        </div>
                        <div className="text-sm font-medium w-12 text-right">{source.percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data Management Tab */}
          {activeTab === "data" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Data Management</h3>

              {/* Storage Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Storage Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Records:</span>
                    <div className="font-medium">{databaseStats.totalRecords}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Storage Type:</span>
                    <div className="font-medium">Browser Database</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Version:</span>
                    <div className="font-medium">{databaseService.getVersion()}</div>
                  </div>
                </div>
              </div>

              {/* Export/Import Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => handleExport("json")}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download className="h-5 w-5 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium">Export JSON</p>
                    <p className="text-sm text-gray-600">Full data export</p>
                  </div>
                </button>

                <button
                  onClick={() => handleExport("csv")}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium">Export CSV</p>
                    <p className="text-sm text-gray-600">Spreadsheet format</p>
                  </div>
                </button>

                <label className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Upload className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium">Import Data</p>
                    <p className="text-sm text-gray-600">Upload JSON file</p>
                  </div>
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={isImporting} />
                </label>

                <button
                  onClick={handleClearAll}
                  className="flex items-center justify-center gap-2 p-4 border border-red-300 rounded-lg hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Clear All</p>
                    <p className="text-sm text-red-500">Delete everything</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">User Preferences</h3>

              <div className="space-y-6">
                {/* Concept Map Settings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Concept Map Abstraction Level: {settings.preferences.defaultAbstractionLevel}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.preferences.defaultAbstractionLevel}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        preferences: {
                          ...settings.preferences,
                          defaultAbstractionLevel: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Show All</span>
                    <span>Core Only</span>
                  </div>
                </div>

                {/* Auto-analyze Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Auto-analyze new content</label>
                    <p className="text-xs text-gray-500">Automatically analyze URLs when added</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.preferences.autoAnalyze}
                      onChange={(e) =>
                        saveSettings({
                          ...settings,
                          preferences: {
                            ...settings.preferences,
                            autoAnalyze: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Theme Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <select
                    value={settings.preferences.theme}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        preferences: {
                          ...settings.preferences,
                          theme: e.target.value as "light" | "dark" | "auto",
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Enable notifications</label>
                    <p className="text-xs text-gray-500">Get notified about new content and updates</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.preferences.notifications}
                      onChange={(e) =>
                        saveSettings({
                          ...settings,
                          preferences: {
                            ...settings.preferences,
                            notifications: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === "email" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Weekly Digest Email</h3>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Automatic Weekly Digest</span>
                </div>
                <p className="text-blue-800 text-sm">
                  Get a personalized digest of your week's learning every Monday at 4:00 AM Eastern Time.
                </p>
              </div>

              <div className="space-y-6">
                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address for Weekly Digest
                  </label>
                  <input
                    type="email"
                    value={digestEmail}
                    onChange={(e) => setDigestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Current Status */}
                {digestStatus && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900">Digest Scheduled</span>
                    </div>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>Email: {digestStatus.email}</p>
                      <p>Next delivery: {new Date(digestStatus.scheduledFor).toLocaleString()}</p>
                      <p>Status: {digestStatus.status}</p>
                      {digestStatus.lastSent && <p>Last sent: {new Date(digestStatus.lastSent).toLocaleString()}</p>}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveDigestEmail}
                    disabled={!digestEmail}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {digestStatus ? "Update" : "Schedule"} Weekly Digest
                  </button>

                  <button
                    onClick={handleTestDigest}
                    disabled={!digestEmail}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Send Test Digest
                  </button>

                  {digestStatus && (
                    <button
                      onClick={handleUnscheduleDigest}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Unschedule
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium mb-2">How it works:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Digest is generated every Monday at 4:00 AM Eastern Time</li>
                    <li>• Includes all content you've analyzed in the past week</li>
                    <li>• AI-powered summary with key insights and connections</li>
                    <li>• Personalized recommendations and action items</li>
                    <li>• Automatically scheduled to repeat weekly</li>
                  </ul>
                </div>

                {/* Debug Information */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium mb-2 text-yellow-900">🔍 Scheduling Debug Info:</h4>
                  <button
                    onClick={() => {
                      const debug = digestScheduler.debugScheduling()
                      console.log("Digest Scheduling Debug:", debug)
                      setStatus(
                        `📊 Debug info logged to console. Next digest: ${debug.nextDigest.et} (${debug.nextDigest.hoursFromNow}h from now)`,
                      )
                      setTimeout(() => setStatus(""), 10000)
                    }}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-1 px-3 rounded text-sm"
                  >
                    Check Scheduling Logic
                  </button>
                  <div className="mt-2 text-sm text-yellow-800">
                    <p>Click to verify next Monday 4 AM ET calculation and view all scheduled digests.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === "performance" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Performance Settings</h3>

              <div className="space-y-6">
                {/* Performance Metrics */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Current Performance</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Avg Analysis Time:</span>
                      <div className="font-medium">{databaseStats.performance.avgAnalysisTime}s</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Success Rate:</span>
                      <div className="font-medium">{databaseStats.performance.successRate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Cache Hit Rate:</span>
                      <div className="font-medium">N/A</div>
                    </div>
                  </div>
                </div>

                {/* Performance Settings */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Enable caching</label>
                    <p className="text-xs text-gray-500">Cache analysis results for faster loading</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.performance.enableCaching}
                      onChange={(e) =>
                        saveSettings({
                          ...settings,
                          performance: {
                            ...settings.performance,
                            enableCaching: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Size: {settings.performance.batchSize}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={settings.performance.batchSize}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        performance: {
                          ...settings.performance,
                          batchSize: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Maintenance Tab */}
          {activeTab === "maintenance" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Database Maintenance</h3>

              {/* Maintenance Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleVacuum}
                  disabled={isVacuuming}
                  className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-5 w-5 text-blue-600 ${isVacuuming ? "animate-spin" : ""}`} />
                  <div className="text-left">
                    <p className="font-medium">Clean Database</p>
                    <p className="text-sm text-gray-600">Remove orphaned data</p>
                  </div>
                </button>

                <button
                  onClick={performHealthCheck}
                  className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Activity className="h-5 w-5 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium">Health Check</p>
                    <p className="text-sm text-gray-600">Verify system integrity</p>
                  </div>
                </button>
              </div>

              {/* Database Tables */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-medium mb-4">Database Tables</h4>
                <div className="space-y-3">
                  {Object.entries(databaseStats.tables).map(([table, count]) => (
                    <div key={table} className="flex items-center justify-between">
                      <span className="font-medium capitalize">{table}</span>
                      <span className="text-gray-600">{count} records</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Checks */}
              {healthCheck && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium mb-4">System Checks</h4>
                  <div className="space-y-3">
                    {Object.entries(healthCheck.checks).map(([check, status]) => (
                      <div key={check} className="flex items-center justify-between">
                        <span className="capitalize">{check.replace(/([A-Z])/g, " $1").trim()}</span>
                        <div className="flex items-center gap-2">
                          {status ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-sm ${status ? "text-green-600" : "text-red-600"}`}>
                            {status ? "Healthy" : "Issues"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
