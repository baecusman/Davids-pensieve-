"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Download, Upload, Trash2 } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

export function SettingsView() {
  const { user } = useAuth()
  const [digestFrequency, setDigestFrequency] = useState("WEEKLY")
  const [digestEmail, setDigestEmail] = useState(user?.email || "")
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [status, setStatus] = useState("")

  const handleExportData = () => {
    setStatus("📦 Exporting data...")

    // Simulate export
    setTimeout(() => {
      const data = {
        user: user,
        exportedAt: new Date().toISOString(),
        version: "1.0.0",
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pensive-data-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setStatus("✅ Data exported successfully!")
      setTimeout(() => setStatus(""), 3000)
    }, 1000)
  }

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setStatus("📥 Importing data...")

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        console.log("Imported data:", data)
        setStatus("✅ Data imported successfully!")
        setTimeout(() => setStatus(""), 3000)
      } catch (error) {
        setStatus("❌ Failed to import data")
        setTimeout(() => setStatus(""), 3000)
      }
    }
    reader.readAsText(file)
  }

  const handleSaveSettings = () => {
    setStatus("💾 Saving settings...")

    // Simulate save
    setTimeout(() => {
      setStatus("✅ Settings saved successfully!")
      setTimeout(() => setStatus(""), 3000)
    }, 500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      {/* Status Message */}
      {status && (
        <div
          className={`p-3 rounded-lg border ${
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={user?.name || ""} placeholder="Enter your name" />
            </div>
            <Button onClick={handleSaveSettings}>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Digest Settings</CardTitle>
            <CardDescription>Configure how often you receive knowledge digests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Digests</Label>
                <p className="text-sm text-gray-600">Receive AI-generated summaries via email</p>
              </div>
              <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="frequency">Digest Frequency</Label>
              <Select value={digestFrequency} onValueChange={setDigestFrequency}>
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

            <div className="space-y-2">
              <Label htmlFor="digest-email">Digest Email</Label>
              <Input
                id="digest-email"
                value={digestEmail}
                onChange={(e) => setDigestEmail(e.target.value)}
                placeholder="Enter email for digests"
              />
            </div>

            <Button onClick={handleSaveSettings}>Save Digest Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export, import, or manage your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" onClick={handleExportData} className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export Data</span>
              </Button>

              <div>
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" id="import-file" />
                <Button variant="outline" asChild className="flex items-center space-x-2 w-full">
                  <label htmlFor="import-file" className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span>Import Data</span>
                  </label>
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-red-600">Danger Zone</Label>
              <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
              <Button variant="destructive" size="sm" className="flex items-center space-x-2">
                <Trash2 className="h-4 w-4" />
                <span>Delete Account</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
