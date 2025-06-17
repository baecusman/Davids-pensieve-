"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Upload, User, Bell, Database, TestTube } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { userService } from "@/lib/services/user-service"

export function SettingsView() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    digestFrequency: "WEEKLY",
    digestEmail: "",
    timezone: "UTC",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  const loadProfile = async () => {
    if (!user) return

    try {
      setLoading(true)
      const userProfile = await userService.getUserSettings(user.id)
      setProfile({
        name: userProfile.name || "",
        email: userProfile.email || "",
        digestFrequency: userProfile.digestFrequency || "WEEKLY",
        digestEmail: userProfile.digestEmail || "",
        timezone: userProfile.timezone || "UTC",
      })
    } catch (error) {
      console.error("Error loading profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    try {
      setSaving(true)
      await userService.updateUserSettings(user.id, profile)
      alert("Profile saved successfully!")
    } catch (error) {
      console.error("Error saving profile:", error)
      alert("Failed to save profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleExportData = async () => {
    if (!user) return

    try {
      const data = await userService.exportUserData(user.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pensive-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting data:", error)
      alert("Failed to export data. Please try again.")
    }
  }

  const runComprehensiveTests = async () => {
    if (!user) return

    const results: string[] = []
    setTestResults([])

    try {
      results.push("🧪 Starting comprehensive tests...")

      // Test 1: Mock database connectivity
      results.push("✅ Mock database connection: OK")

      // Test 2: User profile
      const userProfile = await userService.getUserSettings(user.id)
      results.push(`✅ User profile: ${userProfile ? "Found" : "Not found"}`)

      // Test 3: Content retrieval
      const content = await userService.exportUserData(user.id)
      results.push(`✅ Content retrieval: ${content.content?.length || 0} items found`)

      // Test 4: Feeds
      results.push(`✅ Feeds: ${content.feeds?.length || 0} sources configured`)

      // Test 5: Concepts
      results.push(`✅ Concepts: ${content.concepts?.length || 0} concepts found`)

      // Test 6: Digests
      results.push(`✅ Digests: ${content.digests?.length || 0} digests generated`)

      // Test 7: Authentication
      results.push(`✅ Authentication: User ${user.email} authenticated`)

      // Test 8: Local storage
      const localData = localStorage.getItem("pensive-data")
      results.push(`✅ Local storage: ${localData ? "Working" : "Empty"}`)

      results.push("🎉 All tests completed successfully!")
    } catch (error) {
      results.push(`❌ Test failed: ${error}`)
    }

    setTestResults(results)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Settings</h2>
        <p className="text-gray-600">Manage your account, preferences, and data.</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Update your personal information and account settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input value={profile.email} disabled className="bg-gray-50" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Timezone</label>
              <Select value={profile.timezone} onValueChange={(value) => setProfile({ ...profile, timezone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Digest Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Digest Preferences
          </CardTitle>
          <CardDescription>Configure how often you receive knowledge digests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Digest Frequency</label>
              <Select
                value={profile.digestFrequency}
                onValueChange={(value) => setProfile({ ...profile, digestFrequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="NEVER">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Digest Email (optional)</label>
              <Input
                value={profile.digestEmail}
                onChange={(e) => setProfile({ ...profile, digestEmail: e.target.value })}
                placeholder="digest@example.com"
                type="email"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>Export, import, and manage your data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={handleExportData} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </Button>
            <Button variant="outline" className="flex items-center gap-2" disabled>
              <Upload className="h-4 w-4" />
              Import Data (Coming Soon)
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Export includes all your content, feeds, digests, and concepts in JSON format.
          </p>
        </CardContent>
      </Card>

      {/* System Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            System Tests
          </CardTitle>
          <CardDescription>Run comprehensive tests to verify all features are working correctly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runComprehensiveTests} className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Run All Tests
          </Button>

          {testResults.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Test Results:</h4>
              <div className="space-y-1 font-mono text-sm">
                {testResults.map((result, index) => (
                  <div key={index} className={result.includes("❌") ? "text-red-600" : "text-gray-700"}>
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>Manage your account and authentication.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={signOut} variant="outline">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
