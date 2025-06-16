interface User {
  id: string
  username: string
  password: string
  email?: string
  displayName: string
  createdAt: string
  lastLogin: string
  preferences: {
    theme: "light" | "dark" | "auto"
    defaultAbstractionLevel: number
    autoAnalyze: boolean
    digestEmail?: string
  }
}

interface AuthSession {
  userId: string
  username: string
  loginTime: string
  expiresAt: string
}

class SimpleAuthManager {
  private static instance: SimpleAuthManager
  private users: Map<string, User> = new Map()
  private currentSession: AuthSession | null = null
  private storageKey = "pensive-simple-users"
  private sessionKey = "pensive-simple-session"
  private sessionDuration = 24 * 60 * 60 * 1000 // 24 hours

  static getInstance(): SimpleAuthManager {
    if (!SimpleAuthManager.instance) {
      SimpleAuthManager.instance = new SimpleAuthManager()
    }
    return SimpleAuthManager.instance
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
    // Create 10 default users if none exist
    if (this.users.size === 0) {
      for (let i = 1; i <= 10; i++) {
        const userId = `user_${i}`
        const user: User = {
          id: userId,
          username: i.toString(),
          password: i.toString(),
          displayName: `User ${i}`,
          createdAt: new Date().toISOString(),
          lastLogin: "",
          preferences: {
            theme: "light",
            defaultAbstractionLevel: 30,
            autoAnalyze: true,
          },
        }

        this.users.set(userId, user)
      }

      this.saveUsers()
      console.log("Created 10 default users (1-10)")
    }
  }

  login(username: string, password: string): { success: boolean; user?: User; error?: string } {
    try {
      const user = Array.from(this.users.values()).find((u) => u.username === username && u.password === password)

      if (!user) {
        return { success: false, error: "Invalid username or password" }
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
    return Array.from(this.users.values()).sort((a, b) => Number.parseInt(a.username) - Number.parseInt(b.username))
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

  updateUserEmail(email: string): boolean {
    const currentUser = this.getCurrentUser()
    if (!currentUser) return false

    try {
      const updatedUser = {
        ...currentUser,
        email,
        preferences: {
          ...currentUser.preferences,
          digestEmail: email,
        },
      }

      this.users.set(currentUser.id, updatedUser)
      this.saveUsers()

      console.log(`Updated email for user: ${currentUser.username}`)
      return true
    } catch (error) {
      console.error("Error updating user email:", error)
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

export const simpleAuth = SimpleAuthManager.getInstance()
