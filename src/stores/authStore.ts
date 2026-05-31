import { create } from 'zustand'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
  initialize: () => () => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateDisplayName: (name: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,

  initialize: () => {
    // onAuthStateChange callback must NOT be async (STATE.md locked decision D-08).
    // Supabase requires synchronous callback — async causes silent auth failures
    // or missed events (RESEARCH.md Pitfall 2).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        set({
          user: session?.user ?? null,
          session,
          isLoading: false,
          error: null,
        })

        // Update Realtime JWT so existing channels pick up the new token
        // (STATE.md locked decision: realtime.setAuth on every auth change — Pitfall 6)
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token)
        } else {
          supabase.realtime.setAuth(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  },

  signInWithGoogle: async () => {
    set({ error: null })
    // redirectTo MUST be on the Supabase Auth allow-list (Dashboard → Authentication →
    // URL Configuration). If it isn't, Supabase silently falls back to "Site URL" —
    // which on a stock dev setup is http://localhost:5173 and breaks prod OAuth.
    // Required config: Site URL = prod origin; Additional Redirect URLs include
    // prod origin, vercel preview wildcard, and http://localhost:5173.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) set({ error: error.message })
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) set({ error: error.message })
  },

  // CRITICAL: Do NOT call updateDisplayName from inside onAuthStateChange.
  // The USER_UPDATED event will re-fire the callback with the server-confirmed
  // user, producing an idempotent second set() — this is correct behavior.
  updateDisplayName: async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    // Optimistic update before server responds
    set((state) => ({
      user: state.user
        ? { ...state.user, user_metadata: { ...state.user.user_metadata, display_name: trimmed } }
        : null,
      error: null,
    }))

    const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } })
    if (error) {
      // Rollback: re-fetch server state
      const { data: { user } } = await supabase.auth.getUser()
      set({ user, error: error.message })
    }
  },
}))
