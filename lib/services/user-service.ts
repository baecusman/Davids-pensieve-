import { mockDb } from "@/lib/database/mock-db"

export class UserService {
  private static instance: UserService

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  async getUserSettings(userId: string) {
    const user = await mockDb.getUser(userId)

    if (!user) {
      throw new Error("User not found")
    }

    return {
      digestFrequency: user.digestFrequency || "WEEKLY",
      digestEmail: user.digestEmail || "",
      timezone: user.timezone || "UTC",
      name: user.name || "",
      email: user.email || "",
    }
  }

  async updateUserSettings(userId: string, settings: any) {
    const updatedUser = await mockDb.updateUser(userId, {
      digestFrequency: settings.digestFrequency,
      digestEmail: settings.digestEmail,
      timezone: settings.timezone,
      name: settings.name,
    })

    if (!updatedUser) {
      throw new Error("Failed to update user settings")
    }

    return settings
  }

  async exportUserData(userId: string) {
    return await mockDb.exportUserData(userId)
  }

  async deleteUserData(userId: string) {
    // In a real implementation, this would delete all user data
    console.log(`Would delete all data for user: ${userId}`)
    return true
  }
}

export const userService = UserService.getInstance()
