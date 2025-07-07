"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react" // Added useCallback
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
  Cloud,
  Calendar,
} from "lucide-react"
import { databaseService } from "@/lib/database/database-service"
import { emailScheduler } from "@/lib/email-scheduler" // Assuming this is still relevant or adapted
import DriveExport from "@/components/google-drive/drive-export" // Assuming this is still relevant or adapted
import { googleAuth } from "@/lib/auth/google-auth" // Assuming this is still relevant or adapted
import { digestScheduler } from "@/lib/digest/digest-scheduler" // Assuming this is still relevant or adapted
// import { simpleAuth } from "@/lib/auth/simple-auth" // Removed: simpleAuth is deleted
import { supabase } from "@/lib/auth/supabase" // Import Supabase client for auth

interface AppSettings {
  version: string
  preferences: {
    defaultAbstractionLevel: number
    autoAnalyze: boolean
    theme: "light" | "dark" | "auto"
    notifications: boolean
    autoBackup: boolean // This might be less relevant with Supabase
    maxStorageSize: number // MB, also might be less relevant
  }
  performance: {
    enableCaching: boolean // Client-side caching?
    batchSize: number
    indexingEnabled: boolean // DB indexing is via Supabase
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

// Define a type for Supabase user if not already available globally
interface SupabaseUser {
    id: string;
    email?: string;
    user_metadata?: { digestEmail?: string }; // Example, adjust to your actual user_metadata structure
}


export default function SettingsView() {
  const [databaseStats, setDatabaseStats] = useState<any>(null) // Consider specific type
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [healthCheck, setHealthCheck] = useState<any>(null) // Consider specific type
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isVacuuming, setIsVacuuming] = useState(false)
  const [status, setStatus] = useState("")
  const [activeTab, setActiveTab] = useState<
    "overview" | "data" | "preferences" | "performance" | "maintenance" | "email" | "drive"
  >("overview")

  const [digestEmail, setDigestEmail] = useState("")
  const [digestStatus, setDigestStatus] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);


  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user as SupabaseUser | null ?? null;
      setCurrentUser(user);

      const appStats = await databaseService.getApplicationStats();
      setDatabaseStats(appStats);

      const storedSettings = localStorage.getItem("pensive-settings-v2");
      const defaultSettings: AppSettings = {
        version: databaseService.getVersion(), // Get version from service
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
      };
      setSettings(storedSettings ? { ...defaultSettings, ...JSON.parse(storedSettings) } : defaultSettings);

      if (user?.user_metadata?.digestEmail) {
        setDigestEmail(user.user_metadata.digestEmail);
      }
      if (user) {
        // Assuming digestScheduler is adapted for Supabase user IDs
        const userDigestStatus = digestScheduler.getUserDigestStatus(user.id);
        setDigestStatus(userDigestStatus);
      }

    } catch (error) {
      console.error("Error loading initial data:", error);
      setStatus("❌ Error loading settings data");
    } finally {
        setIsLoading(false);
    }
  }, []); // No dependencies, runs once on mount effectively due to outer useEffect

  const [isLoading, setIsLoading] = useState(true); // Added isLoading state

  useEffect(() => {
    loadInitialData();
    performHealthCheck(); // performHealthCheck is async now

    const interval = setInterval(() => {
      loadInitialData(); // Reload all data periodically
      performHealthCheck();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadInitialData]);


  const performHealthCheck = async () => {
    try {
      // healthCheck is now async
      const health = await databaseService.healthCheck()
      setHealthCheck(health)
    } catch (error) {
      console.error("Health check failed:", error)
      setHealthCheck({
        status: "error",
        checks: { supabaseConnection: false }, // Updated for new health check structure
        issues: ["Health check failed"],
      })
    }
  }

  const saveSettings = (newSettings: AppSettings) => {
    try {
      localStorage.setItem("pensive-settings-v2", JSON.stringify(newSettings))
      setSettings(newSettings)
      if (newSettings.email.enabled) {
        emailScheduler.updateSchedule(newSettings.email.digestSchedule)
      } else {
        emailScheduler.disable()
      }
      setStatus("✅ Settings saved")
    } catch (error) {
      console.error("Error saving settings:", error)
      setStatus("❌ Error saving settings")
    }
    setTimeout(() => setStatus(""), 3000)
  }

  const handleExport = async (format: "json" | "csv" = "json") => {
    setIsExporting(true)
    try {
      // exportData is now async
      const data = await databaseService.exportData(format)
      const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pensive-export-${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus(`✅ Data exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error("Export error:", error)
      setStatus("❌ Export failed")
    } finally {
      setIsExporting(false)
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setStatus("Reading file...")
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(content)
          if (data.content && Array.isArray(data.content)) {
            setStatus(`Importing ${data.content.length} items...`)
            let imported = 0, errors = 0
            for (const item of data.content) {
              try {
                // storeAnalyzedContent is already async
                await databaseService.storeAnalyzedContent({
                  title: item.title, url: item.url, content: item.content,
                  source: item.source || "imported", analysis: item.analysis,
                })
                imported++
              } catch (err) { errors++; console.error("Error importing item:", err); }
            }
            setStatus(`✅ Imported ${imported} items${errors > 0 ? ` (${errors} errors)` : ""}`)
            loadInitialData() // Reload data
          } else { setStatus("❌ Invalid file format") }
        } else { setStatus("❌ Only JSON files are supported") }
      } catch (err) { console.error("Import error:", err); setStatus("❌ Import failed - invalid file") }
      finally { setIsImporting(false); setTimeout(() => setStatus(""), 5000) }
    }
    reader.readAsText(file)
  }

  const handleVacuum = async () => {
    setIsVacuuming(true)
    setStatus("🧹 Cleaning database (Operation N/A with Supabase)...")
    console.warn("Vacuum operation is not directly applicable from client with Supabase. Database optimization is handled by Supabase/PostgreSQL.")
    // const result = await databaseService.vacuum() // vacuum was removed
    // setStatus(`✅ Cleaned ${result.cleaned} items${result.errors.length > 0 ? ` (${result.errors.length} errors)` : ""}`)
    setTimeout(() => {
        setStatus("Info: Database cleaning is managed by Supabase.")
        loadInitialData() // Reload data
        performHealthCheck()
        setIsVacuuming(false)
    }, 3000);
  }

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear ALL data? This cannot be undone via this interface easily with Supabase.")) {
      return
    }
    setStatus("Clearing data (Operation N/A with Supabase from client)...")
    console.warn("Clear All operation is not directly applicable from client with Supabase. This would require direct DB operations or specific backend endpoint.")
    // await databaseService.clear() // clear was removed
    setTimeout(() => {
        setStatus("Info: Clearing all data should be done via Supabase console or backend.")
        loadInitialData() // Reload data
        performHealthCheck()
    }, 3000);
  }

  const handleSaveDigestEmail = async () => {
    if (!currentUser || !digestEmail) {
      setStatus("❌ User not logged in or email is empty.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }
    try {
      // Update user_metadata in Supabase
      const { error } = await supabase.auth.updateUser({
        data: { digestEmail: digestEmail } // 'data' is Supabase's field for user_metadata
      });
      if (error) throw error;

      // Re-fetch user to confirm update
      const { data: { user: updatedUser } } = await supabase.auth.getUser();
      setCurrentUser(updatedUser as SupabaseUser | null);


      const success = digestScheduler.scheduleUserDigest(currentUser.id, digestEmail);
      if (success) {
        setStatus("✅ Weekly digest scheduled/updated.");
        loadInitialData(); // Refresh status
      } else {
        setStatus("❌ Failed to schedule digest.");
      }
    } catch (error) {
      console.error("Error saving digest email:", error);
      setStatus("❌ Error saving digest email.");
    }
    setTimeout(() => setStatus(""), 5000);
  };

  const handleUnscheduleDigest = () => {
    if (!currentUser) return;
    const success = digestScheduler.unscheduleUserDigest(currentUser.id);
    if (success) {
      setStatus("✅ Weekly digest unscheduled");
      setDigestStatus(null); // Clear local status
      // Optionally clear from Supabase user_metadata if that's the desired behavior
      // supabase.auth.updateUser({ data: { digestEmail: null } });
    } else {
      setStatus("❌ Failed to unschedule digest");
    }
    setTimeout(() => setStatus(""), 3000);
  };

  const handleTestDigest = async () => {
    if (!currentUser || !digestEmail) {
        setStatus("❌ User not available or email not set for digest.");
        setTimeout(() => setStatus(""), 3000);
        return;
    }
    try {
      setStatus("📧 Generating and sending test digest...")
      // Assuming digestScheduler.sendTestDigest is adapted for Supabase user ID
      await digestScheduler.sendTestDigest(currentUser.id, digestEmail)
      setStatus("✅ Test digest sent successfully!")
    } catch (error) {
      console.error("Test digest error:", error)
      setStatus("❌ Failed to send test digest")
    }
    setTimeout(() => setStatus(""), 5000)
  }

  const handleTestEmail = async () => {
    if (!settings?.email.address) {
      setStatus("❌ Please enter an email address in general settings first.")
      setTimeout(() => setStatus(""), 3000)
      return
    }
    try {
      setStatus("📧 Sending test email...")
      // Assuming emailScheduler.sendTestDigest is generic enough
      await emailScheduler.sendTestDigest(settings.email.address)
      setStatus("✅ Test email sent successfully!")
    } catch (error) {
      console.error("Test email error:", error)
      setStatus("❌ Failed to send test email")
    }
    setTimeout(() => setStatus(""), 5000)
  }


  const getStatusColor = (statusKey: string) => { // statusKey instead of status
    switch (statusKey) {
      case "healthy": return "text-green-600 bg-green-50 border-green-200";
      case "degraded": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "error": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  }

  const getStatusIcon = (statusKey: string) => { // statusKey instead of status
    switch (statusKey) {
      case "healthy": return <CheckCircle className="h-4 w-4" />;
      case "degraded": return <AlertTriangle className="h-4 w-4" />;
      case "error": return <XCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  }

  if (isLoading || !databaseStats || !settings) { // Added isLoading to condition
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading settings...</span>
        </div>
      </div>
    )
  }

  // Null checks for databaseStats properties before rendering
  const totalContent = databaseStats.content?.totalContent || 0;
  const recentCount = databaseStats.content?.recentCount || 0;
  const totalConcepts = databaseStats.concepts?.totalConcepts || 0;
  const averageFrequency = databaseStats.concepts?.averageFrequency || 0;
  const growthRate = databaseStats.content?.growthRate || 0; // Assuming growthRate could be on content
  const successRate = databaseStats.performance?.successRate || 0; // Assuming performance might be undefined
  const topSources = databaseStats.content?.topSources || [];
  const totalRecords = databaseStats.totalRecords || 0; // If totalRecords was part of the old structure

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
            status.includes("❌") ? "bg-red-50 border-red-200 text-red-800"
              : status.includes("✅") ? "bg-green-50 border-green-200 text-green-800"
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
          {healthCheck.issues && healthCheck.issues.length > 0 && (
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
              { id: "drive", label: "Google Drive", icon: Cloud },
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
                  <div className="text-2xl font-bold text-blue-900">{totalContent}</div>
                  <div className="text-sm text-blue-700">{recentCount} this week</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">Concepts</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{totalConcepts}</div>
                  <div className="text-sm text-green-700">
                    Avg: {averageFrequency.toFixed(1)} mentions
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-900">Growth Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {growthRate > 0 ? "+" : ""}
                    {growthRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-700">vs last week (N/A)</div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-900">Success Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {successRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-orange-700">analysis success (N/A)</div>
                </div>
              </div>

              {/* Top Sources */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Top Content Sources</h3>
                <div className="space-y-3">
                  {topSources.map((source: any, index: number) => (
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
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Storage Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div> <span className="text-gray-600">Total Records (Content):</span> <div className="font-medium">{totalContent}</div> </div>
                  <div> <span className="text-gray-600">Storage Type:</span> <div className="font-medium">Supabase Cloud</div> </div>
                  <div> <span className="text-gray-600">Version:</span> <div className="font-medium">{settings.version}</div> </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => handleExport("json")} disabled={isExporting} className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <Download className="h-5 w-5 text-green-600" />
                  <div> <p className="font-medium">Export JSON</p> <p className="text-sm text-gray-600">Full data export</p> </div>
                </button>
                <button onClick={() => handleExport("csv")} disabled={isExporting} className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <Download className="h-5 w-5 text-blue-600" />
                  <div> <p className="font-medium">Export CSV</p> <p className="text-sm text-gray-600">Spreadsheet format</p> </div>
                </button>
                <label className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Upload className="h-5 w-5 text-blue-600" />
                  <div> <p className="font-medium">Import Data</p> <p className="text-sm text-gray-600">Upload JSON file</p> </div>
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={isImporting} />
                </label>
                <button onClick={handleClearAll} className="flex items-center justify-center gap-2 p-4 border border-red-300 rounded-lg hover:bg-red-50 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  <div> <p className="font-medium">Clear All</p> <p className="text-sm text-red-500">Delete everything (N/A)</p> </div>
                </button>
              </div>
            </div>
          )}

          {/* Preferences Tab (Largely unchanged as it's localStorage based) */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">User Preferences</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"> Default Concept Map Abstraction Level: {settings.preferences.defaultAbstractionLevel}% </label>
                  <input type="range" min="0" max="100" value={settings.preferences.defaultAbstractionLevel}
                    onChange={(e) => saveSettings({ ...settings, preferences: { ...settings.preferences, defaultAbstractionLevel: Number(e.target.value) }})}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1"> <span>Show All</span> <span>Core Only</span> </div>
                </div>
                <div className="flex items-center justify-between">
                  <div> <label className="text-sm font-medium text-gray-700">Auto-analyze new content</label> <p className="text-xs text-gray-500">Automatically analyze URLs when added</p> </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.preferences.autoAnalyze}
                      onChange={(e) => saveSettings({ ...settings, preferences: { ...settings.preferences, autoAnalyze: e.target.checked }})}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <select value={settings.preferences.theme}
                    onChange={(e) => saveSettings({ ...settings, preferences: { ...settings.preferences, theme: e.target.value as "light" | "dark" | "auto" }})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" >
                    <option value="light">Light</option> <option value="dark">Dark</option> <option value="auto">Auto (System)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div> <label className="text-sm font-medium text-gray-700">Enable notifications</label> <p className="text-xs text-gray-500">Get notified about new content and updates</p> </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.preferences.notifications}
                      onChange={(e) => saveSettings({ ...settings, preferences: { ...settings.preferences, notifications: e.target.checked }})}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Email Tab - Needs Supabase auth for user context */}
           {activeTab === "email" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Weekly Digest Email</h3>
              {currentUser ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2"> <Calendar className="h-5 w-5 text-blue-600" /> <span className="font-medium text-blue-900">Automatic Weekly Digest</span> </div>
                    <p className="text-blue-800 text-sm"> Get a personalized digest of your week's learning every Monday at 4:00 AM Eastern Time. </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2"> Email Address for Weekly Digest </label>
                    <input type="email" value={digestEmail} onChange={(e) => setDigestEmail(e.target.value)} placeholder="your@email.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {digestStatus && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2"> <CheckCircle className="h-4 w-4 text-green-600" /> <span className="font-medium text-green-900">Digest Scheduled</span> </div>
                      <div className="text-sm text-green-800 space-y-1">
                        <p>Email: {digestStatus.email}</p>
                        <p>Next delivery: {new Date(digestStatus.scheduledFor).toLocaleString()}</p>
                        <p>Status: {digestStatus.status}</p>
                        {digestStatus.lastSent && <p>Last sent: {new Date(digestStatus.lastSent).toLocaleString()}</p>}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={handleSaveDigestEmail} disabled={!digestEmail} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
                      <Mail className="h-4 w-4" /> {digestStatus ? "Update" : "Schedule"} Weekly Digest
                    </button>
                    <button onClick={handleTestDigest} disabled={!digestEmail} className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Send Test Digest
                    </button>
                    {digestStatus && ( <button onClick={handleUnscheduleDigest} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"> Unschedule </button> )}
                  </div>
                </>
              ) : (
                <p className="text-gray-600">Please log in to manage digest settings.</p>
              )}
            </div>
          )}


          {/* Performance Tab (Largely unchanged as it's localStorage based) */}
          {activeTab === "performance" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Performance Settings</h3>
              <div className="space-y-6">
                 <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Current Performance (Client)</h4>
                  <p className="text-sm text-gray-700">Note: Server performance metrics are managed by Supabase.</p>
                </div>
                <div className="flex items-center justify-between">
                  <div> <label className="text-sm font-medium text-gray-700">Enable client-side caching</label> <p className="text-xs text-gray-500">Cache analysis results for faster loading</p> </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.performance.enableCaching}
                      onChange={(e) => saveSettings({ ...settings, performance: { ...settings.performance, enableCaching: e.target.checked }})}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"> Client Batch Size (e.g., for UI lists): {settings.performance.batchSize} </label>
                  <input type="range" min="10" max="100" step="10" value={settings.performance.batchSize}
                    onChange={(e) => saveSettings({ ...settings, performance: { ...settings.performance, batchSize: Number(e.target.value)}})}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1"> <span>10</span> <span>100</span> </div>
                </div>
              </div>
            </div>
          )}

          {/* Maintenance Tab */}
          {activeTab === "maintenance" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Database Maintenance</h3>
              <p className="text-sm text-gray-600">Database maintenance and optimization are primarily handled by Supabase for cloud-hosted PostgreSQL instances.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={handleVacuum} disabled={isVacuuming} className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <RefreshCw className={`h-5 w-5 text-blue-600 ${isVacuuming ? "animate-spin" : ""}`} />
                  <div> <p className="font-medium">Clean Database (N/A)</p> <p className="text-sm text-gray-600">Managed by Supabase</p> </div>
                </button>
                <button onClick={performHealthCheck} className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Activity className="h-5 w-5 text-green-600" />
                  <div> <p className="font-medium">Client Health Check</p> <p className="text-sm text-gray-600">Verify client-Supabase link</p> </div>
                </button>
              </div>
               {/* System Checks - Health check is now async */}
              {healthCheck && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium mb-4">System Checks</h4>
                  <div className="space-y-3">
                    {Object.entries(healthCheck.checks).map(([check, checkStatus]) => ( // Renamed status to checkStatus
                      <div key={check} className="flex items-center justify-between">
                        <span className="capitalize">{check.replace(/([A-Z])/g, " $1").trim()}</span>
                        <div className="flex items-center gap-2">
                          {checkStatus ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                          <span className={`text-sm ${checkStatus ? "text-green-600" : "text-red-600"}`}>
                            {checkStatus ? "Healthy" : "Issues"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Google Drive Tab - Assuming googleAuth and DriveExport are adapted or placeholders */}
          {activeTab === "drive" && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Google Drive Integration</h3>
              {googleAuth.getCurrentUser() ? ( // Check if user is logged in via googleAuth
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-2"> <Cloud className="h-5 w-5 text-blue-600" /> <span className="font-medium text-blue-900">Connected Account</span> </div>
                    <div className="text-sm text-blue-800">{googleAuth.getCurrentUser()?.email}</div>
                  </div>
                  <DriveExport />
                </>
              ) : (
                <p className="text-gray-600">Google Drive features require Google sign-in. (Auth system undergoing refactor)</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
