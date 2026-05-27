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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) set({ error: error.message })
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) set({ error: error.message })
  },
}))
