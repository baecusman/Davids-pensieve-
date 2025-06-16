interface User {
  id: string
  username: string
  email: string
  displayName: string
  createdAt: string
  lastLogin: string
  preferences: {
    theme: "light" | "dark" | "auto"
    defaultAbstractionLevel: number
    autoAnalyze: boolean
  }
}

interface AuthSession {
  userId: string
  username: string
  loginTime: string
  expiresAt: string
}

class AuthManager {
  private static instance: AuthManager
  private users: Map<string, User> = new Map()
  private currentSession: AuthSession | null = null
  private storageKey = "pensive-users"
  private sessionKey = "pensive-session"
  private sessionDuration = 24 * 60 * 60 * 1000 // 24 hours

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager()
    }
    return AuthManager.instance
  }

  constructor() {
    this.loadUsers()
    this.loadSession()
    this.createDefaultUsers()
  }

  private loadUsers(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const usersArray: User[] = JSON.parse(stored)
        usersArray.forEach((user) => {
          this.users.set(user.id, user)
        })
        console.log(`Loaded ${usersArray.length} users`)
      }
    } catch (error) {
      console.error("Error loading users:", error)
    }
  }

  private saveUsers(): void {
    try {
      const usersArray = Array.from(this.users.values())
      localStorage.setItem(this.storageKey, JSON.stringify(usersArray))
    } catch (error) {
      console.error("Error saving users:", error)
    }
  }

  private loadSession(): void {
    try {
      const stored = localStorage.getItem(this.sessionKey)
      if (stored) {
        const session: AuthSession = JSON.parse(stored)

        // Check if session is expired
        if (new Date(session.expiresAt) > new Date()) {
          this.currentSession = session
          console.log(`Restored session for user: ${session.username}`)
        } else {
          localStorage.removeItem(this.sessionKey)
          console.log("Session expired, cleared")
        }
      }
    } catch (error) {
      console.error("Error loading session:", error)
      localStorage.removeItem(this.sessionKey)
    }
  }

  private saveSession(): void {
    try {
      if (this.currentSession) {
        localStorage.setItem(this.sessionKey, JSON.stringify(this.currentSession))
      } else {
        localStorage.removeItem(this.sessionKey)
      }
    } catch (error) {
      console.error("Error saving session:", error)
    }
  }

  private createDefaultUsers(): void {
    // Create default users if none exist
    if (this.users.size === 0) {
      const defaultUsers = [
        {
          username: "admin",
          email: "admin@pensive.app",
          displayName: "Administrator",
        },
        {
          username: "analyst",
          email: "analyst@pensive.app",
          displayName: "Content Analyst",
        },
        {
          username: "researcher",
          email: "researcher@pensive.app",
          displayName: "Research Lead",
        },
      ]

      defaultUsers.forEach((userData) => {
        this.createUser(userData.username, userData.email, userData.displayName)
      })

      console.log("Created default users")
    }
  }

  createUser(username: string, email: string, displayName: string): { success: boolean; user?: User; error?: string } {
    try {
      // Check if username already exists
      const existingUser = Array.from(this.users.values()).find(
        (u) => u.username.toLowerCase() === username.toLowerCase(),
      )
      if (existingUser) {
        return { success: false, error: "Username already exists" }
      }

      // Check if email already exists
      const existingEmail = Array.from(this.users.values()).find((u) => u.email.toLowerCase() === email.toLowerCase())
      if (existingEmail) {
        return { success: false, error: "Email already exists" }
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const user: User = {
        id: userId,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        displayName,
        createdAt: new Date().toISOString(),
        lastLogin: "",
        preferences: {
          theme: "light",
          defaultAbstractionLevel: 30,
          autoAnalyze: true,
        },
      }

      this.users.set(userId, user)
      this.saveUsers()

      console.log(`Created user: ${username}`)
      return { success: true, user }
    } catch (error) {
      console.error("Error creating user:", error)
      return { success: false, error: "Failed to create user" }
    }
  }

  login(username: string): { success: boolean; user?: User; error?: string } {
    try {
      const user = Array.from(this.users.values()).find((u) => u.username.toLowerCase() === username.toLowerCase())

      if (!user) {
        return { success: false, error: "User not found" }
      }

      // Update last login
      user.lastLogin = new Date().toISOString()
      this.users.set(user.id, user)
      this.saveUsers()

      // Create session
      const expiresAt = new Date(Date.now() + this.sessionDuration).toISOString()
      this.currentSession = {
        userId: user.id,
        username: user.username,
        loginTime: new Date().toISOString(),
        expiresAt,
      }

      this.saveSession()

      console.log(`User logged in: ${username}`)
      return { success: true, user }
    } catch (error) {
      console.error("Error during login:", error)
      return { success: false, error: "Login failed" }
    }
  }

  logout(): void {
    if (this.currentSession) {
      console.log(`User logged out: ${this.currentSession.username}`)
      this.currentSession = null
      this.saveSession()
    }
  }

  getCurrentUser(): User | null {
    if (!this.currentSession) return null

    const user = this.users.get(this.currentSession.userId)
    return user || null
  }

  getCurrentUserId(): string | null {
    return this.currentSession?.userId || null
  }

  isAuthenticated(): boolean {
    if (!this.currentSession) return false

    // Check if session is expired
    if (new Date(this.currentSession.expiresAt) <= new Date()) {
      this.logout()
      return false
    }

    return true
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values()).sort((a, b) => a.username.localeCompare(b.username))
  }

  updateUserPreferences(preferences: Partial<User["preferences"]>): boolean {
    const currentUser = this.getCurrentUser()
    if (!currentUser) return false

    try {
      const updatedUser = {
        ...currentUser,
        preferences: {
          ...currentUser.preferences,
          ...preferences,
        },
      }

      this.users.set(currentUser.id, updatedUser)
      this.saveUsers()

      console.log(`Updated preferences for user: ${currentUser.username}`)
      return true
    } catch (error) {
      console.error("Error updating user preferences:", error)
      return false
    }
  }

  deleteUser(userId: string): boolean {
    try {
      const user = this.users.get(userId)
      if (!user) return false

      // Don't allow deleting the current user
      if (userId === this.currentSession?.userId) {
        return false
      }

      this.users.delete(userId)
      this.saveUsers()

      console.log(`Deleted user: ${user.username}`)
      return true
    } catch (error) {
      console.error("Error deleting user:", error)
      return false
    }
  }

  // Session management
  extendSession(): void {
    if (this.currentSession) {
      const expiresAt = new Date(Date.now() + this.sessionDuration).toISOString()
      this.currentSession.expiresAt = expiresAt
      this.saveSession()
    }
  }

  getSessionInfo(): { username: string; loginTime: string; expiresAt: string } | null {
    if (!this.currentSession) return null

    return {
      username: this.currentSession.username,
      loginTime: this.currentSession.loginTime,
      expiresAt: this.currentSession.expiresAt,
    }
  }

  // Admin functions
  getUserStats(): {
    totalUsers: number
    activeUsers: number
    recentLogins: Array<{ username: string; lastLogin: string }>
  } {
    const users = this.getAllUsers()
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const recentLogins = users
      .filter((u) => u.lastLogin && new Date(u.lastLogin) > weekAgo)
      .map((u) => ({ username: u.username, lastLogin: u.lastLogin }))
      .sort((a, b) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime())

    return {
      totalUsers: users.length,
      activeUsers: recentLogins.length,
      recentLogins,
    }
  }
}

export const authManager = AuthManager.getInstance()
