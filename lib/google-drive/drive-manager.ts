interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: string
  createdTime: string
  modifiedTime: string
  webViewLink: string
}

interface ExportOptions {
  format: "json" | "csv"
  includeAnalysis: boolean
  includeConceptMap: boolean
  timeRange?: {
    start: Date
    end: Date
  }
}

class GoogleDriveManager {
  private static instance: GoogleDriveManager
  private appFolderId: string | null = null
  private readonly APP_FOLDER_NAME = "Pensive Data"

  static getInstance(): GoogleDriveManager {
    if (!GoogleDriveManager.instance) {
      GoogleDriveManager.instance = new GoogleDriveManager()
    }
    return GoogleDriveManager.instance
  }

  private async getAccessToken(): Promise<string> {
    const { googleAuth } = await import("@/lib/auth/google-auth")
    const token = googleAuth.getAccessToken()

    if (!token) {
      throw new Error("No Google access token available")
    }

    return token
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken()

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    })

    // Handle token refresh if needed
    if (response.status === 401) {
      const { googleAuth } = await import("@/lib/auth/google-auth")
      const newToken = await googleAuth.refreshAccessToken()

      if (newToken) {
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        })
      }
    }

    return response
  }

  async initializeAppFolder(): Promise<string> {
    try {
      // Check if app folder already exists
      const searchResponse = await this.makeAuthenticatedRequest(
        `https://www.googleapis.com/drive/v3/files?q=name='${this.APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      )

      if (!searchResponse.ok) {
        throw new Error("Failed to search for app folder")
      }

      const searchData = await searchResponse.json()

      if (searchData.files && searchData.files.length > 0) {
        this.appFolderId = searchData.files[0].id
        console.log("Found existing Pensive folder:", this.appFolderId)
        return this.appFolderId
      }

      // Create app folder
      const createResponse = await this.makeAuthenticatedRequest("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: this.APP_FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
          description: "Pensive app data exports and backups",
        }),
      })

      if (!createResponse.ok) {
        throw new Error("Failed to create app folder")
      }

      const folderData = await createResponse.json()
      this.appFolderId = folderData.id
      console.log("Created Pensive folder:", this.appFolderId)

      return this.appFolderId
    } catch (error) {
      console.error("Error initializing app folder:", error)
      throw error
    }
  }

  async exportDataToDrive(options: ExportOptions): Promise<{ success: boolean; fileId?: string; error?: string }> {
    try {
      await this.initializeAppFolder()

      // Get data to export - prepareExportData is now async
      const exportData = await this.prepareExportData(options)

      let content: string
      let mimeType: string
      let fileName: string

      if (options.format === "json") {
        content = JSON.stringify(exportData, null, 2)
        mimeType = "application/json"
        fileName = `pensive-export-${new Date().toISOString().split("T")[0]}.json`
      } else {
        // Assuming exportData.content is the array of items for CSV
        content = this.convertToCSV(exportData.content || [])
        mimeType = "text/csv"
        fileName = `pensive-export-${new Date().toISOString().split("T")[0]}.csv`
      }

      const metadata = {
        name: fileName,
        parents: [this.appFolderId!], // Non-null assertion as initializeAppFolder should set it
        description: `Pensive data export - ${new Date().toLocaleString()}`,
      }

      const boundary = "-------314159265358979323846"
      const delimiter = "\r\n--" + boundary + "\r\n"
      const close_delim = "\r\n--" + boundary + "--"

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n` +
        content +
        close_delim

      const uploadResponse = await this.makeAuthenticatedRequest(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { "Content-Type": `multipart/related; boundary="${boundary}"` },
          body: multipartRequestBody,
        },
      )

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`Upload failed: ${errorText}`)
      }

      const uploadData = await uploadResponse.json()
      console.log("Successfully exported to Google Drive:", uploadData.id)
      return { success: true, fileId: uploadData.id }

    } catch (error) {
      console.error("Error exporting to Google Drive:", error)
      return { success: false, error: error instanceof Error ? error.message : "Export failed" }
    }
  }

  private async prepareExportData(options: ExportOptions): Promise<any> {
    // Dynamic import for databaseService as it might not be available server-side initially
    // However, this class seems client-side oriented due to fetch.
    const { databaseService } = await import("@/lib/database/database-service")

    const contentOptions: any = { limit: 10000 } // High limit to fetch all for export
    if (options.timeRange) {
      // Assuming databaseService.getStoredContent can handle dateRange
      // This was not explicitly shown in its refactor, adjust if needed.
      // For now, we'll assume it filters by timeframe if available, or we fetch all.
      // contentOptions.dateRange = options.timeRange; // If supported
    }

    // getStoredContent is now async
    const contentData = await databaseService.getStoredContent(contentOptions)

    const exportData: any = {
      version: databaseService.getVersion(), // Use service's getVersion
      exportedAt: new Date().toISOString(),
      exportOptions: options,
      content: contentData.items, // getStoredContent returns an object { items, total, hasMore }
    }

    if (options.includeAnalysis) {
      // getApplicationStats is now async and has a different structure
      exportData.stats = await databaseService.getApplicationStats()
    }

    if (options.includeConceptMap) {
      // getConceptMapData is now async
      exportData.conceptMap = await databaseService.getConceptMapData(50) // Default abstraction
    }

    return exportData
  }

  private convertToCSV(items: any[]): string {
    if (items.length === 0) return ""
    // Ensure 'analysis' and its properties exist, provide defaults if not
    const headers = ["Title", "URL", "Summary", "Priority", "Tags", "Created", "Source"]
    const rows = items.map((item) => [
      `"${item.title?.replace(/"/g, '""') || ""}"`,
      `"${item.url || ""}"`,
      `"${item.analysis?.summaryText?.replace(/"/g, '""') || ""}"`, // Adjusted to summaryText
      item.analysis?.priority || "",
      `"${item.analysis?.tags?.join(", ") || ""}"`,
      item.createdAt || "",
      item.source || "",
    ])
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  async listExports(): Promise<DriveFile[]> {
    try {
      await this.initializeAppFolder()

      const response = await this.makeAuthenticatedRequest(
        `https://www.googleapis.com/drive/v3/files?q=parents in '${this.appFolderId}' and trashed=false&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)&orderBy=modifiedTime desc`,
      )

      if (!response.ok) {
        throw new Error("Failed to list exports")
      }

      const data = await response.json()
      return data.files || []
    } catch (error) {
      console.error("Error listing exports:", error)
      return []
    }
  }

  async deleteExport(fileId: string): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
      })

      return response.ok
    } catch (error) {
      console.error("Error deleting export:", error)
      return false
    }
  }

  async importFromDrive(fileId: string): Promise<{ success: boolean; imported?: number; error?: string }> {
    try {
      // Download file content
      const response = await this.makeAuthenticatedRequest(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      )

      if (!response.ok) {
        throw new Error("Failed to download file")
      }

      const content = await response.text()

      // Parse and import data
      const data = JSON.parse(content)

      if (data.content && Array.isArray(data.content)) {
        const { databaseService } = await import("@/lib/database/database-service")

        let imported = 0
        let errors = 0

        for (const item of data.content) {
          try {
            await databaseService.storeAnalyzedContent({
              title: item.title,
              url: item.url,
              content: item.content,
              source: item.source || "imported",
              analysis: item.analysis,
            })
            imported++
          } catch (error) {
            console.error("Error importing item:", error)
            errors++
          }
        }

        return {
          success: true,
          imported,
        }
      } else {
        return {
          success: false,
          error: "Invalid file format",
        }
      }
    } catch (error) {
      console.error("Error importing from Drive:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      }
    }
  }

  async getStorageQuota(): Promise<{ used: number; limit: number; available: number } | null> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "https://www.googleapis.com/drive/v3/about?fields=storageQuota",
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      const quota = data.storageQuota

      return {
        used: Number.parseInt(quota.usage || "0"),
        limit: Number.parseInt(quota.limit || "0"),
        available: Number.parseInt(quota.limit || "0") - Number.parseInt(quota.usage || "0"),
      }
    } catch (error) {
      console.error("Error getting storage quota:", error)
      return null
    }
  }
}

export const googleDrive = GoogleDriveManager.getInstance()
