"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/auth/supabase'; // Ensure this path is correct
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (params: { email?: string; password?: string; provider?: 'google' | 'github' }) => Promise<any>;
  signUp: (params: { email?: string; password?: string; options?: Record<string, any> }) => Promise<any>;
  signOut: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    // Check for initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    }).catch(err => {
        console.error("Error getting initial session:", err);
        setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Handle specific events if needed
        switch (event) {
          case 'SIGNED_IN':
            // console.log('User signed in:', session?.user?.email);
            break;
          case 'SIGNED_OUT':
            // console.log('User signed out');
            break;
          case 'USER_UPDATED':
            // console.log('User updated:', session?.user?.email);
            break;
          // Add other cases as needed: TOKEN_REFRESHED, PASSWORD_RECOVERY, etc.
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const signIn = async (params: { email?: string; password?: string; provider?: 'google' | 'github' }) => {
    setIsLoading(true);
    setError(null);
    try {
      let response;
      if (params.provider) {
        // OAuth sign-in
        response = await supabase.auth.signInWithOAuth({ provider: params.provider });
      } else if (params.email && params.password) {
        // Email/password sign-in
        response = await supabase.auth.signInWithPassword({
          email: params.email,
          password: params.password,
        });
      } else {
        throw new Error("Email/password or provider must be provided for sign in.");
      }

      if (response.error) throw response.error;
      // Session and user state will be updated by onAuthStateChange listener
      return response;
    } catch (e: any) {
      console.error("Sign in error:", e);
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (params: { email?: string; password?: string; options?: Record<string, any> }) => {
    setIsLoading(true);
    setError(null);
    if (!params.email || !params.password) {
        setIsLoading(false);
        const err = new Error("Email and password are required for sign up.");
        setError(err);
        throw err;
    }
    try {
      const response = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: params.options, // e.g., { data: { display_name: 'Test User' } }
      });
      if (response.error) throw response.error;
      // For Supabase, signUp might send a confirmation email.
      // The user state might not change until email is confirmed, depending on settings.
      // onAuthStateChange will handle actual user state changes.
      return response;
    } catch (e: any) {
      console.error("Sign up error:", e);
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await supabase.auth.signOut();
      if (response.error) throw response.error;
      // User and session will be cleared by onAuthStateChange listener
      return response;
    } catch (e: any) {
      console.error("Sign out error:", e);
      setError(e);
      throw e;
    } finally {
      // setIsLoading(false); // onAuthStateChange will set loading to false
    }
  };

  const value = {
    user,
    session,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
