import { supabase } from "@/lib/database/supabase-client"

export class UserService {
  private static instance: UserService

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  async getUserSettings(userId: string) {
    const { data: user, error } = await supabase.from("users").select("*").eq("id", userId).single()

    if (error) {
      console.error("Error getting user settings:", error)
      throw new Error(`Failed to get user settings: ${error.message}`)
    }

    return {
      digestFrequency: user.digest_frequency || "WEEKLY",
      digestEmail: user.digest_email || "",
      timezone: user.timezone || "UTC",
      name: user.name || "",
      email: user.email || "",
    }
  }

  async updateUserSettings(userId: string, settings: any) {
    const { error } = await supabase
      .from("users")
      .update({
        digest_frequency: settings.digestFrequency,
        digest_email: settings.digestEmail,
        timezone: settings.timezone,
        name: settings.name,
      })
      .eq("id", userId)

    if (error) {
      console.error("Error updating user settings:", error)
      throw new Error(`Failed to update user settings: ${error.message}`)
    }

    return settings
  }

  async exportUserData(userId: string) {
    try {
      // Get all user data from Supabase
      const [userResult, contentResult, feedsResult, digestsResult, conceptsResult, analysisResult] = await Promise.all(
        [
          supabase.from("users").select("*").eq("id", userId).single(),
          supabase.from("content").select("*").eq("user_id", userId),
          supabase.from("feeds").select("*").eq("user_id", userId),
          supabase.from("digests").select("*").eq("user_id", userId),
          supabase.from("concepts").select("*").eq("user_id", userId),
          supabase.from("analysis").select("*").eq("user_id", userId),
        ],
      )

      return {
        user: userResult.data,
        content: contentResult.data || [],
        feeds: feedsResult.data || [],
        digests: digestsResult.data || [],
        concepts: conceptsResult.data || [],
        analysis: analysisResult.data || [],
        exportedAt: new Date().toISOString(),
        version: "1.0",
      }
    } catch (error) {
      console.error("Error exporting user data:", error)
      throw new Error("Failed to export user data")
    }
  }

  async deleteUserData(userId: string) {
    try {
      // Delete all user data (cascading deletes will handle relationships)
      await supabase.from("users").delete().eq("id", userId)
      return true
    } catch (error) {
      console.error("Error deleting user data:", error)
      throw new Error("Failed to delete user data")
    }
  }
}

export const userService = UserService.getInstance()
