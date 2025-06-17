"use client"

import { useState, useEffect } from "react"
import { userService } from "@/lib/services/user-service"
import { useAuth } from "@/components/auth/auth-provider"

const SettingsView = () => {
  const [settings, setSettings] = useState<any>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadSettings()
    }
  }, [user])

  const loadSettings = async () => {
    try {
      const settings = await userService.getUserSettings(user!.id)
      setSettings(settings)
    } catch (error) {
      console.error("Error loading settings:", error)
    }
  }

  const handleSaveSettings = async (newSettings: any) => {
    try {
      await userService.updateUserSettings(user!.id, newSettings)
      setSettings(newSettings)
    } catch (error) {
      console.error("Error saving settings:", error)
    }
  }

  const handleExportData = async () => {
    try {
      const data = await userService.exportUserData(user!.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pensive-data-${new Date().toISOString().split("T")[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting data:", error)
    }
  }

  return (
    <div>
      <h1>Settings</h1>
      {settings ? (
        <div>
          <pre>{JSON.stringify(settings, null, 2)}</pre>
          <button onClick={handleExportData}>Export Data</button>
        </div>
      ) : (
        <p>Loading settings...</p>
      )}
    </div>
  )
}

export default SettingsView
