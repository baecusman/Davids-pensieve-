"use client"

import type React from "react"
import { useState } from "react" // Removed useEffect as quick login is removed
import { User, Lock, UserPlus, LogIn, Mail } from "lucide-react" // Added Mail icon
import { useAuth } from "./auth-provider" // Import useAuth

interface LoginFormProps {
  onLogin: (user: any) => void // User type will be Supabase user
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState("") // Changed from username to email
  const [password, setPassword] = useState("") // Added password state
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "", // Added password for new user
    confirmPassword: "", // Added confirm password
    displayName: "", // Kept displayName, can be passed as metadata
  })

  const auth = useAuth(); // Use the auth hook
  // Error and loading state will come from auth.error and auth.isLoading

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      // Use auth.setError or handle locally if preferred, for now local
      auth.setError(new Error("Please enter email and password."))
      return
    }
    try {
      const { data, error } = await auth.signIn({ email: email.trim(), password: password.trim() })
      if (error) {
        // Error is already set in auth context by signIn method
        return;
      }
      if (data.user) {
        onLogin(data.user) // onLogin might not be needed if AuthProvider handles global state
      }
    } catch (err) {
      // Error is already set in auth context by signIn method
      console.error("Login submission error", err) // Additional local log
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.email.trim() || !newUser.password.trim() || !newUser.displayName.trim()) {
      auth.setError(new Error("Please fill in all fields for new user."))
      return
    }
    if (newUser.password !== newUser.confirmPassword) {
      auth.setError(new Error("Passwords do not match."))
      return
    }

    try {
      // Pass displayName in options.data for user_metadata
      const { data, error } = await auth.signUp({
        email: newUser.email.trim(),
        password: newUser.password.trim(),
        options: {
          data: {
            display_name: newUser.displayName.trim(),
            // username: newUser.username.trim(), // If you want to store username
          }
        }
      })

      if (error) {
         // Error is already set in auth context by signUp method
        return;
      }
      // For Supabase, signUp might send a confirmation email.
      // The user is not typically logged in immediately.
      // The onLogin prop might need rethinking here, or called only after email confirmation.
      // For now, we'll assume onAuthStateChange in AuthProvider handles the user state.
      // If immediate login is desired and configured in Supabase (e.g., auto-confirm for dev),
      // onAuthStateChange should pick it up.
      // onLogin(data.user) // This might be premature if email confirmation is needed.
      setIsCreatingUser(false); // Switch back to login form
      setEmail(newUser.email); // Pre-fill email for login
      setPassword(""); // Clear password
      auth.setError(null); // Clear previous errors
      alert("Sign up successful! Please check your email to confirm your account if required, then log in.");

    } catch (err) {
      // Error is already set in auth context by signUp method
      console.error("Create user submission error", err)
    }
  }

  // Quick Login feature removed as it's not standard with Supabase email/password auth

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Pensive</h1>
          <p className="text-gray-600">
            {isCreatingUser ? "Create your account" : "Sign in to access your personal knowledge base"}
          </p>
        </div>

        {auth.error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">{auth.error.message}</div>}

        {!isCreatingUser ? (
          <>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={auth.isLoading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={auth.isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={auth.isLoading || !email.trim() || !password.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="h-5 w-5" />
                {auth.isLoading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={() => { setIsCreatingUser(true); auth.setError(null); }}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mx-auto"
              >
                <UserPlus className="h-4 w-4" />
                Create New User
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleCreateUser} className="space-y-4"> {/* Reduced space for more fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="Your full name or nickname"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={auth.isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter your email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={auth.isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Choose a strong password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={auth.isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={auth.isLoading}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingUser(false)
                    auth.setError(null) // Clear error from auth context
                    setNewUser({ email: "", password: "", confirmPassword: "", displayName: "" })
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors"
                  disabled={auth.isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={auth.isLoading || !newUser.email.trim() || !newUser.password.trim() || !newUser.displayName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-5 w-5" />
                  {auth.isLoading ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Secure authentication with Supabase.</p>
        </div>
      </div>
    </div>
  )
}
