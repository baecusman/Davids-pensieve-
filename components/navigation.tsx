"use client"

import { useState } from "react"
import { BookOpen, Network, Settings, Rss, LogOut, Menu, X, Bell, Mail } from "lucide-react"

interface NavigationProps {
  activeView: "digests" | "concept-map" | "source-management" | "settings"
  onViewChange: (view: "digests" | "concept-map" | "source-management" | "settings") => void
  user: any
  onLogout: () => void
}

export default function Navigation({ activeView, onViewChange, user, onLogout }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navItems = [
    {
      id: "digests" as const,
      label: "Digests",
      icon: BookOpen,
      description: "View your content digests",
    },
    {
      id: "concept-map" as const,
      label: "Concept Map",
      icon: Network,
      description: "Explore knowledge connections",
    },
    {
      id: "source-management" as const,
      label: "Sources",
      icon: Rss,
      description: "Manage content sources",
    },
    {
      id: "settings" as const,
      label: "Settings",
      icon: Settings,
      description: "App settings and preferences",
    },
  ]

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pensive</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Knowledge Management</p>
            </div>
          </div>

          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === item.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
                title={item.description}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
            </button>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{user.username}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-gray-500">User {user.username}</p>
                </div>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                    <p className="text-xs text-gray-500">User {user.username}</p>
                    {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
                  </div>

                  <div className="py-2">
                    <button
                      onClick={() => {
                        onViewChange("settings")
                        setShowUserMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>

                    <button
                      onClick={() => {
                        onViewChange("settings")
                        setShowUserMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Mail className="h-4 w-4" />
                      Email Digest
                    </button>

                    <div className="border-t border-gray-100 my-2"></div>

                    <button
                      onClick={() => {
                        onLogout()
                        setShowUserMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id)
                  setIsMobileMenuOpen(false)
                }}
                className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeView === item.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <div className="text-left">
                  <p>{item.label}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close menus */}
      {(showUserMenu || isMobileMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false)
            setIsMobileMenuOpen(false)
          }}
        />
      )}
    </>
  )
}
