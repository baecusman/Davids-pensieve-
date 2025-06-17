"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/components/auth/auth-provider"

export function SettingsView() {
  const { user } = useAuth()
  const [digestFrequency, setDigestFrequency] = useState("WEEKLY")
  const [digestEmail, setDigestEmail] = useState(user?.email || "")
  const [emailEnabled, setEmailEnabled] = useState(true)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export or manage your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Button variant="outline">Export Data</Button>
              <Button variant="outline">Import Data</Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-red-600">Danger Zone</Label>
              <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
              <Button variant="destructive" size="sm">
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
