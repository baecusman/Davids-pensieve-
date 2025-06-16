"use client"

import { useState, useRef, useEffect } from "react"
import { LogOut, Settings, Users, ChevronDown } from "lucide-react"
import { authManager } from "@/lib/auth/auth-manager"

interface UserMenuProps {
  user: any
  onLogout: () => void
  onOpenSettings?: () => void
}

export default function UserMenu({ user, onLogout, onOpenSettings }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = () => {
    authManager.logout()
    onLogout()
    setIsOpen(false)
  }

  const sessionInfo = authManager.getSessionInfo()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white font-medium text-sm">{user.displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="hidden md:block text-left">
          <div className="font-medium text-gray-900 text-sm">{user.displayName}</div>
          <div className="text-xs text-gray-500">@{user.username}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium">{user.displayName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div className="font-medium text-gray-900">{user.displayName}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                <div className="text-xs text-gray-400">@{user.username}</div>
              </div>
            </div>
          </div>

          {/* Session Info */}
          {sessionInfo && (
            <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
              <div>Logged in: {new Date(sessionInfo.loginTime).toLocaleString()}</div>
              <div>Expires: {new Date(sessionInfo.expiresAt).toLocaleString()}</div>
            </div>
          )}

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                onOpenSettings?.()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>

            <button
              onClick={() => {
                // Could open user management modal
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Users className="h-4 w-4" />
              User Management
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 pt-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
