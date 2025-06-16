interface GoogleUser {
  id: string
  email: string
  name: string
  picture: string
  given_name: string
  family_name: string
}

interface GoogleAuthConfig {
  clientId: string
  redirectUri: string
  scope: string[]
}

class GoogleAuthManager {
  private static instance: GoogleAuthManager
  private config: GoogleAuthConfig
  private currentUser: GoogleUser | null = null
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private sessionKey = "pensive-google-session"

  static getInstance(): GoogleAuthManager {
    if (!GoogleAuthManager.instance) {
      GoogleAuthManager.instance = new GoogleAuthManager()
    }
    return GoogleAuthManager.instance
  }

  constructor() {
    this.config = {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      redirectUri: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file", // Google Drive access
        "https://www.googleapis.com/auth/drive.appdata", // App-specific Drive folder
      ],
    }

    this.loadSession()
  }

  private loadSession(): void {
    if (typeof window === "undefined") return

    try {
      const stored = localStorage.getItem(this.sessionKey)
      if (stored) {
        const session = JSON.parse(stored)

        // Check if token is expired (basic check)
        if (session.expiresAt && new Date(session.expiresAt) > new Date()) {
          this.currentUser = session.user
          this.accessToken = session.accessToken
          this.refreshToken = session.refreshToken
          console.log(`Restored Google session for: ${session.user.email}`)
        } else {
          this.clearSession()
        }
      }
    } catch (error) {
      console.error("Error loading Google session:", error)
      this.clearSession()
    }
  }

  private saveSession(user: GoogleUser, accessToken: string, refreshToken?: string, expiresIn = 3600): void {
    if (typeof window === "undefined") return

    try {
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      const session = {
        user,
        accessToken,
        refreshToken: refreshToken || this.refreshToken,
        expiresAt,
      }

      localStorage.setItem(this.sessionKey, JSON.stringify(session))
      this.currentUser = user
      this.accessToken = accessToken
      if (refreshToken) this.refreshToken = refreshToken
    } catch (error) {
      console.error("Error saving Google session:", error)
    }
  }

  private clearSession(): void {
    if (typeof window === "undefined") return

    localStorage.removeItem(this.sessionKey)
    this.currentUser = null
    this.accessToken = null
    this.refreshToken = null
  }

  // Initialize Google OAuth
  async initializeGoogleAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Google Auth can only be initialized in browser"))
        return
      }

      // Load Google Identity Services
      if (!document.getElementById("google-identity-script")) {
        const script = document.createElement("script")
        script.id = "google-identity-script"
        script.src = "https://accounts.google.com/gsi/client"
        script.onload = () => {
          this.setupGoogleAuth()
          resolve()
        }
        script.onerror = () => reject(new Error("Failed to load Google Identity Services"))
        document.head.appendChild(script)
      } else {
        this.setupGoogleAuth()
        resolve()
      }
    })
  }

  private setupGoogleAuth(): void {
    if (typeof window === "undefined" || !window.google) return

    // Initialize Google Identity Services
    window.google.accounts.id.initialize({
      client_id: this.config.clientId,
      callback: this.handleCredentialResponse.bind(this),
      auto_select: false,
      cancel_on_tap_outside: true,
    })
  }

  private async handleCredentialResponse(response: any): Promise<void> {
    try {
      // Decode JWT token to get user info
      const userInfo = this.parseJWT(response.credential)

      const googleUser: GoogleUser = {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
      }

      // For full Google Drive access, we need to use OAuth2 flow
      await this.requestDriveAccess(googleUser)
    } catch (error) {
      console.error("Error handling Google credential:", error)
      throw error
    }
  }

  private parseJWT(token: string): any {
    try {
      const base64Url = token.split(".")[1]
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      throw new Error("Invalid JWT token")
    }
  }

  private async requestDriveAccess(user: GoogleUser): Promise<void> {
    // Use OAuth2 flow for Drive access
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", this.config.clientId)
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", this.config.scope.join(" "))
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", JSON.stringify({ user }))

    // Store user info temporarily
    sessionStorage.setItem("pending-google-user", JSON.stringify(user))

    // Redirect to Google OAuth
    window.location.href = authUrl.toString()
  }

  async handleOAuthCallback(code: string, state?: string): Promise<GoogleUser> {
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch("/api/auth/google/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirectUri: this.config.redirectUri,
        }),
      })

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange code for tokens")
      }

      const tokens = await tokenResponse.json()

      // Get user info from stored session or state
      let user: GoogleUser
      const pendingUser = sessionStorage.getItem("pending-google-user")
      if (pendingUser) {
        user = JSON.parse(pendingUser)
        sessionStorage.removeItem("pending-google-user")
      } else if (state) {
        const stateData = JSON.parse(state)
        user = stateData.user
      } else {
        throw new Error("No user information available")
      }

      // Save session with tokens
      this.saveSession(user, tokens.access_token, tokens.refresh_token, tokens.expires_in)

      return user
    } catch (error) {
      console.error("Error handling OAuth callback:", error)
      throw error
    }
  }

  async signIn(): Promise<GoogleUser> {
    if (!this.config.clientId) {
      throw new Error("Google Client ID not configured")
    }

    await this.initializeGoogleAuth()

    return new Promise((resolve, reject) => {
      if (!window.google) {
        reject(new Error("Google Identity Services not loaded"))
        return
      }

      // Show Google Sign-In prompt
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup
          this.signInWithPopup().then(resolve).catch(reject)
        }
      })

      // Set up a timeout for the promise
      setTimeout(() => {
        reject(new Error("Sign-in timeout"))
      }, 30000)
    })
  }

  private async signInWithPopup(): Promise<GoogleUser> {
    // Fallback popup method
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", this.config.clientId)
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", this.config.scope.join(" "))
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "select_account")

    const popup = window.open(authUrl.toString(), "google-signin", "width=500,height=600,scrollbars=yes,resizable=yes")

    return new Promise((resolve, reject) => {
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          reject(new Error("Sign-in cancelled"))
        }
      }, 1000)

      // Listen for message from popup
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
          clearInterval(checkClosed)
          window.removeEventListener("message", messageHandler)
          popup?.close()
          resolve(event.data.user)
        } else if (event.data.type === "GOOGLE_AUTH_ERROR") {
          clearInterval(checkClosed)
          window.removeEventListener("message", messageHandler)
          popup?.close()
          reject(new Error(event.data.error))
        }
      }

      window.addEventListener("message", messageHandler)
    })
  }

  async signOut(): Promise<void> {
    try {
      // Revoke Google tokens
      if (this.accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: "POST",
        })
      }

      // Sign out from Google Identity Services
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect()
      }

      this.clearSession()
      console.log("Signed out from Google")
    } catch (error) {
      console.error("Error signing out:", error)
      // Clear session anyway
      this.clearSession()
    }
  }

  getCurrentUser(): GoogleUser | null {
    return this.currentUser
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.accessToken !== null
  }

  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available")
    }

    try {
      const response = await fetch("/api/auth/google/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      })

      if (!response.ok) {
        throw new Error("Failed to refresh token")
      }

      const tokens = await response.json()

      if (this.currentUser) {
        this.saveSession(this.currentUser, tokens.access_token, tokens.refresh_token, tokens.expires_in)
      }

      return tokens.access_token
    } catch (error) {
      console.error("Error refreshing token:", error)
      this.clearSession()
      throw error
    }
  }

  // Get user ID for data segmentation
  getUserId(): string | null {
    return this.currentUser?.id || null
  }

  // Get user info for display
  getUserInfo(): { name: string; email: string; picture: string } | null {
    if (!this.currentUser) return null

    return {
      name: this.currentUser.name,
      email: this.currentUser.email,
      picture: this.currentUser.picture,
    }
  }
}

// Global type declarations
declare global {
  interface Window {
    google: any
  }
}

export const googleAuth = GoogleAuthManager.getInstance()
