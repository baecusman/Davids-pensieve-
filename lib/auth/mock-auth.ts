// Mock authentication for preview
export interface MockUser {
  id: string
  email: string
  name: string
}

class MockAuthService {
  private currentUser: MockUser | null = null
  private isAuthenticated = false

  constructor() {
    // Auto-login with mock user for preview
    this.currentUser = {
      id: "mock-user-1",
      email: "demo@pensive.app",
      name: "Demo User",
    }
    this.isAuthenticated = true
  }

  getCurrentUser(): MockUser | null {
    return this.currentUser
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated
  }

  async signIn(email: string, password: string): Promise<MockUser> {
    // Mock sign in - always succeeds
    this.currentUser = {
      id: "mock-user-1",
      email,
      name: email.split("@")[0],
    }
    this.isAuthenticated = true
    return this.currentUser
  }

  async signUp(email: string, password: string, name?: string): Promise<MockUser> {
    // Mock sign up - always succeeds
    this.currentUser = {
      id: "mock-user-1",
      email,
      name: name || email.split("@")[0],
    }
    this.isAuthenticated = true
    return this.currentUser
  }

  async signOut(): Promise<void> {
    this.currentUser = null
    this.isAuthenticated = false
  }

  onAuthStateChange(callback: (user: MockUser | null) => void) {
    // Mock auth state change listener
    callback(this.currentUser)
    return () => {} // Unsubscribe function
  }
}

export const mockAuth = new MockAuthService()
