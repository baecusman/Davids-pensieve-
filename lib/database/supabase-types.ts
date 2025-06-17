export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      content: {
        Row: {
          id: string
          title: string
          url: string
          content: string
          source: string
          hash: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          title: string
          url: string
          content: string
          source: string
          hash: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          title?: string
          url?: string
          content?: string
          source?: string
          hash?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      analysis: {
        Row: {
          id: string
          content_id: string
          summary: Json
          entities: Json
          tags: string[]
          priority: string
          full_content?: string
          confidence: number
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          content_id: string
          summary: Json
          entities: Json
          tags: string[]
          priority: string
          full_content?: string
          confidence: number
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          content_id?: string
          summary?: Json
          entities?: Json
          tags?: string[]
          priority?: string
          full_content?: string
          confidence?: number
          created_at?: string
          user_id?: string
        }
      }
      concepts: {
        Row: {
          id: string
          name: string
          type: string
          description?: string
          frequency: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          description?: string
          frequency: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          description?: string
          frequency?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      relationships: {
        Row: {
          id: string
          from_concept_id: string
          to_concept_id: string
          type: string
          strength: number
          content_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          from_concept_id: string
          to_concept_id: string
          type: string
          strength: number
          content_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          from_concept_id?: string
          to_concept_id?: string
          type?: string
          strength?: number
          content_id?: string
          created_at?: string
          user_id?: string
        }
      }
      feeds: {
        Row: {
          id: string
          url: string
          title: string
          description: string
          is_active: boolean
          fetch_interval: number
          last_fetched?: string
          last_item_date?: string
          item_count: number
          error_count: number
          last_error?: string
          created_at: string
          updated_at: string
          user_id: string
          etag?: string
          last_modified?: string
        }
        Insert: {
          id?: string
          url: string
          title: string
          description: string
          is_active?: boolean
          fetch_interval?: number
          last_fetched?: string
          last_item_date?: string
          item_count?: number
          error_count?: number
          last_error?: string
          created_at?: string
          updated_at?: string
          user_id: string
          etag?: string
          last_modified?: string
        }
        Update: {
          id?: string
          url?: string
          title?: string
          description?: string
          is_active?: boolean
          fetch_interval?: number
          last_fetched?: string
          last_item_date?: string
          item_count?: number
          error_count?: number
          last_error?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          etag?: string
          last_modified?: string
        }
      }
      digests: {
        Row: {
          id: string
          type: string
          title: string
          content: string
          content_ids: string[]
          status: string
          scheduled_at: string
          sent_at?: string
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          type: string
          title: string
          content: string
          content_ids: string[]
          status: string
          scheduled_at: string
          sent_at?: string
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          type?: string
          title?: string
          content?: string
          content_ids?: string[]
          status?: string
          scheduled_at?: string
          sent_at?: string
          created_at?: string
          user_id?: string
        }
      }
      jobs: {
        Row: {
          id: string
          type: string
          payload: Json
          status: string
          scheduled_at: string
          started_at?: string
          completed_at?: string
          attempts: number
          max_attempts: number
          error?: string
          created_at: string
          user_id?: string
        }
        Insert: {
          id?: string
          type: string
          payload: Json
          status?: string
          scheduled_at?: string
          started_at?: string
          completed_at?: string
          attempts?: number
          max_attempts?: number
          error?: string
          created_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          type?: string
          payload?: Json
          status?: string
          scheduled_at?: string
          started_at?: string
          completed_at?: string
          attempts?: number
          max_attempts?: number
          error?: string
          created_at?: string
          user_id?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          digest_email?: string
          digest_frequency: string
          theme: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          digest_email?: string
          digest_frequency?: string
          theme?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          digest_email?: string
          digest_frequency?: string
          theme?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
