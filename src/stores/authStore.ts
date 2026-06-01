import { create } from 'zustand'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { usePresenceStore } from '@/stores/presenceStore'

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
      (event: AuthChangeEvent, session: Session | null) => {
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

        // Re-track presence on token refresh: JWT expiry (~1hr) silently drops the
        // presence track. Re-call channel.track() via the single existing auth
        // listener — do NOT add a second onAuthStateChange subscription
        // (RESEARCH Pattern 3). Fire-and-forget; callback stays synchronous (D-08).
        if (event === 'TOKEN_REFRESHED') {
          usePresenceStore.getState().retrack()
        }

        // Sync user metadata into public.profiles on every sign-in.
        // Fire-and-forget: do NOT await, do NOT make callback async (STATE.md locked decision D-08).
        // Catches renames and users created before the handle_new_user trigger existed.
        // Failure is non-critical — Postgres Changes subscription re-syncs on next update.
        if (session?.user) {
          const u = session.user
          supabase.from('profiles').upsert(
            {
              id: u.id,
              display_name:
                u.user_metadata?.display_name ??
                u.user_metadata?.full_name ??
                u.user_metadata?.name ??
                null,
              avatar_url:
                u.user_metadata?.avatar_url ??
                u.user_metadata?.picture ??
                null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
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
