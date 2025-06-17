// Mock authentication for preview
export interface MockUser {
  id: string
  email: string
  name?: string
}

class MockAuth {
  private currentUser: MockUser | null = null
  private listeners: ((user: MockUser | null) => void)[] = []

  async signUp(email: string, password: string, name?: string): Promise<MockUser> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const user: MockUser = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name,
    }

    this.currentUser = user
    this.notifyListeners()
    return user
  }

  async signIn(email: string, password: string): Promise<MockUser> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const user: MockUser = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name: email.split("@")[0],
    }

    this.currentUser = user
    this.notifyListeners()
    return user
  }

  async signOut(): Promise<void> {
    this.currentUser = null
    this.notifyListeners()
  }

  getCurrentUser(): MockUser | null {
    return this.currentUser
  }

  onAuthStateChange(callback: (user: MockUser | null) => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback)
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentUser))
  }
}

export const mockAuth = new MockAuth()
