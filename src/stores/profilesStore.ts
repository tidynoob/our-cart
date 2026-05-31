import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ProfileEntry {
  display_name: string | null
  avatar_url: string | null
}

interface ProfilesState {
  profiles: Record<string, ProfileEntry>
  channel: RealtimeChannel | null

  loadForList: (listId: string) => Promise<void>
  patch: (userId: string, updates: Partial<ProfileEntry>) => void
  unsubscribe: () => void
}

export const useProfilesStore = create<ProfilesState>()((set, get) => ({
  profiles: {},
  channel: null,

  loadForList: async (listId: string) => {
    // StrictMode double-mount guard: remove existing channel before creating a new one (Pitfall 5)
    const existing = get().channel
    if (existing) supabase.removeChannel(existing)

    // Step 1: fetch member user_ids from list_members
    const { data: members } = await supabase
      .from('list_members')
      .select('user_id')
      .eq('list_id', listId)

    const memberIds = members?.map((m) => m.user_id) ?? []

    // Early exit if no members (avoids .in() with empty array)
    if (memberIds.length === 0) {
      set({ profiles: {} })
      return
    }

    // Step 2: fetch profiles for those user_ids
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', memberIds)

    // Step 3: build map and set
    const map: Record<string, ProfileEntry> = {}
    for (const p of profileRows ?? []) {
      map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }
    }
    set({ profiles: map })

    // Step 4: open Postgres Changes channel for live profile updates (D-05)
    // Channel name 'profiles-{listId}' is distinct from 'items-{listId}' (Pitfall 4)
    const channel = supabase
      .channel(`profiles-${listId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as {
            id: string
            display_name: string | null
            avatar_url: string | null
          }
          get().patch(updated.id, {
            display_name: updated.display_name,
            avatar_url: updated.avatar_url,
          })
        }
      )
      .subscribe()

    set({ channel })
  },

  patch: (userId: string, updates: Partial<ProfileEntry>) =>
    set((state) => ({
      profiles: {
        ...state.profiles,
        [userId]: { ...state.profiles[userId], ...updates },
      },
    })),

  unsubscribe: () => {
    const channel = get().channel
    if (channel) {
      supabase.removeChannel(channel)
      set({ channel: null })
    }
  },
}))
