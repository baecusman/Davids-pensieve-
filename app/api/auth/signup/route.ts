import type { NextRequest } from "next/server"
import { supabase } from "@/lib/auth/supabase"
import { prisma } from "@/lib/database/prisma"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Create user in Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (data.user) {
      // Create user in our database
      await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
          preferences: {
            theme: "light",
            defaultAbstractionLevel: 30,
            autoAnalyze: true,
          },
        },
      })
    }

    return new Response(
      JSON.stringify({
        user: data.user,
        session: data.session,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Signup error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
