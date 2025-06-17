import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          created_at: string
          digest_frequency: string
          digest_email: string | null
          timezone: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          created_at?: string
          digest_frequency?: string
          digest_email?: string | null
          timezone?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          created_at?: string
          digest_frequency?: string
          digest_email?: string | null
          timezone?: string
        }
      }
      content: {
        Row: {
          id: string
          user_id: string
          title: string
          url: string | null
          content: string
          source: string
          hash: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          url?: string | null
          content: string
          source: string
          hash: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          url?: string | null
          content?: string
          source?: string
          hash?: string
          created_at?: string
          updated_at?: string
        }
      }
      analysis: {
        Row: {
          id: string
          user_id: string
          content_id: string
          summary: any
          entities: any
          tags: string[]
          priority: string
          full_content: string | null
          confidence: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_id: string
          summary: any
          entities: any
          tags: string[]
          priority: string
          full_content?: string | null
          confidence?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content_id?: string
          summary?: any
          entities?: any
          tags?: string[]
          priority?: string
          full_content?: string | null
          confidence?: number
          created_at?: string
        }
      }
      concepts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          frequency: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          frequency?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          frequency?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      relationships: {
        Row: {
          id: string
          user_id: string
          from_concept_id: string
          to_concept_id: string
          content_id: string
          type: string
          strength: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          from_concept_id: string
          to_concept_id: string
          content_id: string
          type?: string
          strength?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          from_concept_id?: string
          to_concept_id?: string
          content_id?: string
          type?: string
          strength?: number
          created_at?: string
        }
      }
      feeds: {
        Row: {
          id: string
          user_id: string
          name: string
          url: string
          type: string
          is_active: boolean
          last_fetched: string | null
          etag: string | null
          last_modified: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          url: string
          type: string
          is_active?: boolean
          last_fetched?: string | null
          etag?: string | null
          last_modified?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          url?: string
          type?: string
          is_active?: boolean
          last_fetched?: string | null
          etag?: string | null
          last_modified?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      digests: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          content: string
          content_ids: string[]
          status: string
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          content: string
          content_ids: string[]
          status?: string
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          content?: string
          content_ids?: string[]
          status?: string
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
      }
    }
  }
}
