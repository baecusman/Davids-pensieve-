import { createClient } from "@supabase/supabase-js"
import type { Database } from "./supabase-types"

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Server-side admin client (for privileged operations)
export const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseServiceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not defined")
    return supabase
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey)
}

// Client-side singleton pattern
let clientInstance: ReturnType<typeof createClient<Database>> | null = null

export const getClientSideSupabase = () => {
  if (!clientInstance) {
    clientInstance = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return clientInstance
}
