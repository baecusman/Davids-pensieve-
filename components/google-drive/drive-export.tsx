"use client"

import { useState, useEffect } from "react"
import { Download, Upload, Trash2, ExternalLink, Cloud, HardDrive } from "lucide-react"
import { googleDrive } from "@/lib/google-drive/drive-manager"

interface DriveExportProps {
  onClose?: () => void
}

export default function DriveExport({ onClose }: DriveExportProps) {
  const [exports, setExports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [storageQuota, setStorageQuota] = useState<any>(null)
  const [exportOptions, setExportOptions] = useState({
    format: "json" as "json" | "csv",
    includeAnalysis: true,
    includeConceptMap: true,
    timeRange: null as { start: Date; end: Date } | null,
  })

  useEffect(() => {
    loadExports()
    loadStorageQuota()
  }, [])

  const loadExports = async () => {
    try {
      const files = await googleDrive.listExports()
      setExports(files)
    } catch (error) {
      console.error("Error loading exports:", error)
      setStatus("❌ Failed to load exports")
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const loadStorageQuota = async () => {
    try {
      const quota = await googleDrive.getStorageQuota()
      setStorageQuota(quota)
    } catch (error) {
      console.error("Error loading storage quota:", error)
    }
  }

  const handleExport = async () => {
    setLoading(true)
    setStatus("📤 Exporting to Google Drive...")

    try {
      const result = await googleDrive.exportDataToDrive(exportOptions)

      if (result.success) {
        setStatus("✅ Successfully exported to Google Drive!")
        loadExports() // Refresh the list
        loadStorageQuota() // Update quota
      } else {
        setStatus(`❌ Export failed: ${result.error}`)
      }
    } catch (error) {
      console.error("Export error:", error)
      setStatus("❌ Export failed")
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(""), 5000)
    }
  }

  const handleImport = async (fileId: string) => {
    setLoading(true)
    setStatus("📥 Importing from Google Drive...")

    try {
      const result = await googleDrive.importFromDrive(fileId)

      if (result.success) {
        setStatus(`✅ Successfully imported ${result.imported} items!`)
      } else {
        setStatus(`❌ Import failed: ${result.error}`)
      }
    } catch (error) {
      console.error("Import error:", error)
      setStatus("❌ Import failed")
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(""), 5000)
    }
  }

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }

    try {
      const success = await googleDrive.deleteExport(fileId)
      if (success) {
        setStatus("✅ File deleted successfully")
        loadExports()
        loadStorageQuota()
      } else {
        setStatus("❌ Failed to delete file")
      }
    } catch (error) {
      console.error("Delete error:", error)
      setStatus("❌ Failed to delete file")
    } finally {
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const formatFileSize = (bytes: string) => {
    const size = Number.parseInt(bytes)
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatStorageQuota = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Cloud className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Google Drive Export</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
            ×
          </button>
        )}
      </div>

      {/* Status */}
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

      {/* Storage Quota */}
      {storageQuota && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Google Drive Storage</span>
            <span className="text-sm text-gray-600">
              {formatStorageQuota(storageQuota.used)} / {formatStorageQuota(storageQuota.limit)} used
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(storageQuota.used / storageQuota.limit) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Section */}
        <div>
          <h3 className="text-lg font-medium mb-4">Export Data</h3>

          <div className="space-y-4">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
              <div className="flex gap-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="json"
                    checked={exportOptions.format === "json"}
                    onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as "json" | "csv" })}
                    className="mr-2"
                  />
                  JSON (Full Data)
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="csv"
                    checked={exportOptions.format === "csv"}
                    onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as "json" | "csv" })}
                    className="mr-2"
                  />
                  CSV (Spreadsheet)
                </label>
              </div>
            </div>

            {/* Include Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Include</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeAnalysis}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeAnalysis: e.target.checked })}
                    className="mr-2"
                  />
                  Analysis & Statistics
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeConceptMap}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeConceptMap: e.target.checked })}
                    className="mr-2"
                  />
                  Concept Map Data
                </label>
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download className="h-5 w-5" />
              {loading ? "Exporting..." : "Export to Google Drive"}
            </button>
          </div>
        </div>

        {/* Existing Exports */}
        <div>
          <h3 className="text-lg font-medium mb-4">Your Exports</h3>

          {exports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HardDrive className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No exports found</p>
              <p className="text-sm">Create your first export to get started</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {exports.map((file) => (
                <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 truncate">{file.name}</h4>
                      <div className="text-sm text-gray-500 mt-1">
                        <div>Size: {formatFileSize(file.size)}</div>
                        <div>Created: {new Date(file.createdTime).toLocaleDateString()}</div>
                        <div>Modified: {new Date(file.modifiedTime).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleImport(file.id)}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Import
                    </button>

                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </a>

                    <button
                      onClick={() => handleDelete(file.id, file.name)}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
