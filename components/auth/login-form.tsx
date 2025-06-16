"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { User, Lock, UserPlus, LogIn } from "lucide-react"
import { authManager } from "@/lib/auth/auth-manager"

interface LoginFormProps {
  onLogin: (user: any) => void
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState("")
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    displayName: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<any[]>([])

  useEffect(() => {
    // Load available users for quick selection
    const users = authManager.getAllUsers()
    setAvailableUsers(users)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError("Please enter a username")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = authManager.login(username.trim())
      if (result.success && result.user) {
        onLogin(result.user)
      } else {
        setError(result.error || "Login failed")
      }
    } catch (error) {
      setError("Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.displayName.trim()) {
      setError("Please fill in all fields")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = authManager.createUser(newUser.username.trim(), newUser.email.trim(), newUser.displayName.trim())

      if (result.success && result.user) {
        // Auto-login the new user
        const loginResult = authManager.login(result.user.username)
        if (loginResult.success && loginResult.user) {
          onLogin(loginResult.user)
        }
      } else {
        setError(result.error || "Failed to create user")
      }
    } catch (error) {
      setError("Failed to create user. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = (user: any) => {
    setUsername(user.username)
    const result = authManager.login(user.username)
    if (result.success && result.user) {
      onLogin(result.user)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Pensive</h1>
          <p className="text-gray-600">Sign in to access your personal knowledge base</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">{error}</div>}

        {!isCreatingUser ? (
          <>
            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="h-5 w-5" />
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* Quick Login Options */}
            {availableUsers.length > 0 && (
              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Quick Login</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3">
                  {availableUsers.slice(0, 3).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleQuickLogin(user)}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={loading}
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {user.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{user.displayName}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create User Link */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setIsCreatingUser(true)}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mx-auto"
              >
                <UserPlus className="h-4 w-4" />
                Create New User
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Create User Form */}
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingUser(false)
                    setError("")
                    setNewUser({ username: "", email: "", displayName: "" })
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newUser.username.trim() || !newUser.email.trim() || !newUser.displayName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-5 w-5" />
                  {loading ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Secure local authentication • No passwords required</p>
        </div>
      </div>
    </div>
  )
}
