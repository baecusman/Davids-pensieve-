import { supabase } from "@/lib/database/supabase-client"
import { memoryCache } from "@/lib/cache/memory-cache"

export class UserService {
  private static instance: UserService

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  async getUserSettings(userId: string) {
    const cacheKey = `user-settings:${userId}`
    const cached = memoryCache.getJSON<any>(cacheKey)
    if (cached) {
      return cached
    }

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error getting user settings:', error)
      
      // If settings don't exist, create default settings
      if (error.code === 'PGRST116') {
        return this.createDefaultSettings(userId)
      }
      
      return {
        digest_email: null,
        digest_frequency: 'WEEKLY',
        theme: 'light',
      }
    }

    // Cache for 5 minutes
    memoryCache.set(cacheKey, settings, 300)

    return settings
  }

  async updateUserSettings(userId: string, data: {
    digestEmail?: string
    digestFrequency?: string
    theme?: string
  }) {
    const { data: settings, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        digest_email: data.digestEmail,
        digest_frequency: data.digestFrequency,
        theme: data.theme,
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating user settings:', error)
      throw new Error(`Failed to update settings: ${error.message}`)
    }

    // Invalidate cache
    memoryCache.del(`user-settings:${userId}`)

    return settings
  }

  private async createDefaultSettings(userId: string) {
    const defaultSettings = {
      user_id: userId,
      digest_email: null,
      digest_frequency: 'WEEKLY',
      theme: 'light',
    }

    const { data: settings, error } = await supabase
      .from('user_settings')
      .insert(defaultSettings)
      .select()
      .single()

    if (error) {
      console.error('Error creating default settings:', error)
      return defaultSettings
    }

    return settings
  }

  async exportUserData(userId: string) {
    // Get all user data
    const { data: content } = await supabase
      .from('content')
      .select('*')
      .eq('user_id', userId)

    const { data: analysis } = await supabase
      .from('analysis')
      .select('*')
      .eq('user_id', userId)

    const { data: concepts } = await supabase
      .from('concepts')
      .select('*')
      .eq('user_id', userId)

    const { data: relationships } = await supabase
      .from('relationships')
      .select('*')
      .eq('user_id', userId)

    const { data: feeds } = await supabase
      .from('feeds')
      .select('*')
      .eq('user_id', userId)

    const { data
