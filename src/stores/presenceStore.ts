import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js'

// Identity payload replayed on track()/retrack(). display_name/avatar_url are a
// presentational fallback only — PresenceIndicator resolves identity from the
// server-sourced profilesStore (spoofing guard, RESEARCH Pitfall 6 / T-12-01).
interface PresenceIdentity {
  display_name?: string | null
  avatar_url?: string | null
}

export interface PresenceEntry extends PresenceIdentity {
  user_id: string
}

interface PresenceState {
  others: PresenceEntry[] // derived: every key !== self, one entry per key (tab dedupe)
  channel: RealtimeChannel | null

  subscribe: (listId: string, userId: string, identity: PresenceIdentity) => void
  retrack: () => void // re-track on TOKEN_REFRESHED (JWT expiry drops presence ~1hr)
  unsubscribe: () => void
}

// Captured at subscribe() so retrack() can replay the exact same track() payload
// without re-threading userId/identity through the auth listener.
let trackedUserId: string | null = null
let trackedIdentity: PresenceIdentity = {}

/**
 * Derive "others" by KEY, never by inner presence_ref array entry. One entry per
 * user.id; two tabs of the same user collapse because they share one key
 * (RESEARCH Pattern 4 / crit 3). Self is excluded so you never see your own badge.
 */
function deriveOthers(state: RealtimePresenceState, selfId: string): PresenceEntry[] {
  return Object.entries(state)
    .filter(([key]) => key !== selfId)
    .map(([key, presences]) => {
      const latest = presences[presences.length - 1] as unknown as Partial<PresenceEntry>
      return {
        user_id: key,
        display_name: latest?.display_name,
        avatar_url: latest?.avatar_url,
      }
    })
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  others: [],
  channel: null,

  subscribe: (listId, userId, identity) => {
    // StrictMode double-mount guard: remove existing channel before opening a new
    // one (ghost-channel mitigation — mirrors itemsStore.ts:242-243 / D-09).
    const existing = get().channel
    if (existing) supabase.removeChannel(existing)

    // Capture for retrack() replay.
    trackedUserId = userId
    trackedIdentity = identity

    // Dedicated topic — never piggyback on items-${id} (RESEARCH Pitfall 5).
    // key = user.id (NOT presence_ref) so two tabs dedupe to one key.
    const channel = supabase
      .channel(`presence-${listId}`, {
        config: { presence: { key: userId } },
      })
      .on('presence', { event: 'sync' }, () => {
        set({ others: deriveOthers(channel.presenceState(), userId) })
      })
      .on('presence', { event: 'leave' }, () => {
        // Recompute from current state for an immediate badge drop (crit 2).
        set({ others: deriveOthers(channel.presenceState(), userId) })
      })
      .subscribe(async (status) => {
        // MUST wait for SUBSCRIBED before track() (RESEARCH Pitfall 3) — same
        // status gate as itemsStore.ts:299.
        if (status !== 'SUBSCRIBED') return
        await channel.track({ user_id: userId, ...identity })
      })

    set({ channel })
  },

  retrack: () => {
    const channel = get().channel
    if (!channel || !trackedUserId) return
    channel.track({ user_id: trackedUserId, ...trackedIdentity }).catch(() => {})
  },

  unsubscribe: () => {
    const channel = get().channel
    if (channel) {
      // Best-effort untrack first (emits 'leave' near-instantly), then remove the
      // channel from the client registry (removeChannel, not bare unsubscribe()).
      channel.untrack().catch(() => {})
      supabase.removeChannel(channel)
      set({ channel: null, others: [] })
    }
  },
}))
