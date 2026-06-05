import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import { computeReorderKey, safeReorderKey, byPosition } from '@/lib/ordering'
import type { Item } from '@/types/item'
import type { RealtimeChannel } from '@supabase/supabase-js'

// In-flight guard keyed by listId: dedupes redundant fetchItems when
// visibilitychange + online + SUBSCRIBED fire near-simultaneously for the SAME list,
// while still allowing a fetch for a DIFFERENT list — a re-subscribe to another list
// must never be skipped just because the prior list's fetch is still settling (CR-01).
let inFlightListId: string | null = null

// Track pending optimistic temp IDs so the Realtime INSERT echo guard can deduplicate
// server rows that match a pending optimistic item (by name) — prevents the race where
// the Realtime INSERT event arrives before the HTTP response replaces the temp ID (CR-01).
const pendingTempIds = new Set<string>()

// One-shot echo-guard for reorder/move writes (D-10). Mirrors pendingTempIds exactly:
// reorderItem adds the activeId before its optimistic set, and the Realtime UPDATE
// branch consumes-and-skips the matching own-write echo so the row does not flicker
// back to a stale {category, position} before the optimistic value is confirmed.
const pendingReorders = new Set<string>()

interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
  syncStatus: 'connecting' | 'live' | 'reconnecting'
  channel: RealtimeChannel | null

  fetchItems: (listId: string, options?: { background?: boolean }) => Promise<void>
  addItem: (
    listId: string,
    name: string,
    quantity?: string,
    category?: string,
    addedBy?: string,
    userId?: string
  ) => Promise<void>
  updateItem: (
    id: string,
    changes: Partial<Pick<Item, 'name' | 'quantity' | 'category' | 'note' | 'position'>>
  ) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  reorderItem: (activeId: string, overId: string) => Promise<void>
  toggleChecked: (id: string) => Promise<void>
  clearChecked: (listId: string) => Promise<void>
  subscribeToList: (listId: string) => void
  unsubscribe: () => void
}

export const useItemsStore = create<ItemsState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,
  syncStatus: 'connecting',
  channel: null,

  fetchItems: async (listId, { background = false } = {}) => {
    // CR-02 fix: background mode skips loading indicator when items already exist,
    // preventing the list from vanishing during background re-fetches (screen wake,
    // online recovery, Supabase auto-reconnect).
    if (!background) {
      set({ loading: true, error: null })
    } else {
      set({ error: null })
    }
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (error) {
      set({ error: 'Failed to load items', loading: false })
    } else {
      set({ items: data ?? [], loading: false })
    }
  },

  addItem: async (listId, name, quantity, category, addedBy, userId) => {
    const tempId = nanoid()
    // Pitfall 3 / D-11: new rows get a position key appended AFTER the current max
    // so they sort to the end and are never null-position. computeReorderKey(max, null)
    // wraps generateKeyBetween; null currentMax yields the first key for an empty list.
    //
    // WR-01: two near-simultaneous adds (both users at once — the core 2-user case — or
    // a rapid double-tap permitted by the non-blocking duplicate warning) both read the
    // same synchronous snapshot and mint the IDENTICAL key, which later bricks reordering
    // (CR-02). Guard against it: collect every existing position, append past the current
    // max, and if the freshly-minted key collides with one already present, keep appending
    // past it until unique. Bounded loop — terminates as soon as no collision remains.
    const positions = [...get().items]
      .filter((i) => i.position != null)
      .map((i) => i.position as string)
      .sort()
    const existing = new Set(positions)
    let currentMax: string | null = positions.at(-1) ?? null
    let position = computeReorderKey(currentMax, null)
    while (existing.has(position)) {
      currentMax = position
      position = computeReorderKey(currentMax, null)
    }
    const optimisticItem: Item = {
      id: tempId,
      list_id: listId,
      name,
      quantity: quantity || null,
      category: category || null,
      checked: false,
      added_by: addedBy || null,
      user_id: userId ?? null,
      created_at: new Date().toISOString(),
      note: null,
      position,
    }

    // Optimistic add — append to items array and track temp ID for dedup (CR-01)
    pendingTempIds.add(tempId)
    set((state) => ({ items: [...state.items, optimisticItem] }))

    const { data, error } = await supabase
      .from('items')
      .insert({
        list_id: listId,
        name,
        quantity: quantity || null,
        category: category || null,
        added_by: addedBy || null,
        position,
      })
      .select()
      .single()

    if (error) {
      // Per-item rollback: remove only the optimistic item by its temp ID
      // and surface an error so the UI can notify the user (CR-02).
      // SYNC-03: If offline, also set syncStatus to 'reconnecting' (belt-and-suspenders).
      pendingTempIds.delete(tempId)
      set((state) => ({
        items: state.items.filter((i) => i.id !== tempId),
        error: 'Failed to add item',
        syncStatus: !navigator.onLine ? 'reconnecting' : get().syncStatus,
      }))
    } else if (data) {
      // Replace temp item with real DB row (gets the server-generated ID)
      pendingTempIds.delete(tempId)
      set((state) => ({
        items: state.items.map((i) => (i.id === tempId ? data : i)),
      }))
    }
  },

  updateItem: async (id, changes) => {
    const prev = get().items.find((i) => i.id === id)
    if (!prev) return

    // Per-item optimistic update: merge changes into the single item
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    }))

    const { error } = await supabase
      .from('items')
      .update(changes)
      .eq('id', id)

    if (error) {
      // Per-item rollback: restore only the single item to its previous state
      // and surface an error so the UI can notify the user (CR-02).
      // SYNC-03: If offline, also set syncStatus to 'reconnecting' (belt-and-suspenders).
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? prev : i)),
        error: 'Failed to update item',
        syncStatus: !navigator.onLine ? 'reconnecting' : get().syncStatus,
      }))
    }
  },

  deleteItem: async (id) => {
    const prev = get().items.find((i) => i.id === id)
    if (!prev) return

    // Per-item optimistic delete: remove only this item
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }))

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)

    if (error) {
      // Per-item rollback: re-insert only the deleted item
      // and surface an error so the UI can notify the user (CR-02).
      // SYNC-03: If offline, also set syncStatus to 'reconnecting' (belt-and-suspenders).
      set((state) => ({
        items: [...state.items, prev],
        error: 'Failed to delete item',
        syncStatus: !navigator.onLine ? 'reconnecting' : get().syncStatus,
      }))
    }
  },

  reorderItem: async (activeId, overId) => {
    // D-09 cross-category move: dropping onto an item in another section adopts that
    // section's category in a SINGLE combined {category, position} write. Mirrors the
    // updateItem optimistic + per-item rollback template with the pendingReorders
    // echo guard (D-10).
    const prev = get().items.find((i) => i.id === activeId)
    const target = get().items.find((i) => i.id === overId)
    if (!prev || !target) return

    const newCategory = target.category

    // Full sorted list of the TARGET category (including the dragged item) so we can
    // derive DRAG DIRECTION (CR-01). dnd-kit's over.id carries no direction, so we
    // compare the dragged item's current index against the drop-target index:
    // dragging DOWN (active before over) inserts BELOW overId; dragging UP inserts ABOVE.
    // WR-05: only consider rows with non-null positions when deriving neighbor keys, so
    // legacy/null-position rows never feed a null/invalid neighbor into key computation.
    const sorted = get()
      .items.filter((i) => i.category === newCategory && i.position != null)
      .sort(byPosition)
    const activeIdx = sorted.findIndex((i) => i.id === activeId)
    const overIdxFull = sorted.findIndex((i) => i.id === overId)
    // Default to inserting below when the active item is not in this category yet
    // (cross-category drop): it has no current index here, so treat as "dropping onto".
    const insertingBelow = activeIdx === -1 ? true : activeIdx < overIdxFull

    const inCat = sorted.filter((i) => i.id !== activeId)
    const overPos = inCat.findIndex((i) => i.id === overId)
    const before = insertingBelow
      ? inCat[overPos]?.position ?? null
      : inCat[overPos - 1]?.position ?? null
    const after = insertingBelow
      ? inCat[overPos + 1]?.position ?? null
      : inCat[overPos]?.position ?? null

    // CR-02 / WR-06: tolerate degenerate (duplicate/unsorted/legacy) neighbor pairs.
    // safeReorderKey never throws; it falls back to append, or returns null if no key
    // can be computed — in which case surface the error rather than silently no-op.
    const newPosition = safeReorderKey(before, after)
    if (newPosition === null) {
      set({ error: 'Failed to reorder item' })
      return
    }

    // Echo guard BEFORE the optimistic set so our own UPDATE echo is consumed (no flicker).
    pendingReorders.add(activeId)
    set((state) => ({
      items: state.items.map((i) =>
        i.id === activeId ? { ...i, category: newCategory, position: newPosition } : i
      ),
    }))

    // ONE combined write carrying BOTH category and position (D-09).
    const { error } = await supabase
      .from('items')
      .update({ category: newCategory, position: newPosition })
      .eq('id', activeId)

    if (error) {
      // Per-item rollback to prev; drop the echo guard since no echo will arrive.
      // SYNC-03: If offline, also set syncStatus to 'reconnecting' (belt-and-suspenders).
      pendingReorders.delete(activeId)
      set((state) => ({
        items: state.items.map((i) => (i.id === activeId ? prev : i)),
        error: 'Failed to reorder item',
        syncStatus: !navigator.onLine ? 'reconnecting' : get().syncStatus,
      }))
    }
    // On success: leave activeId in pendingReorders — the UPDATE branch consumes it.
  },

  toggleChecked: async (id) => {
    const prev = get().items.find((i) => i.id === id)
    if (!prev) return

    const nextChecked = !prev.checked

    // Optimistic update: flip checked on matching item
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, checked: nextChecked } : i
      ),
      error: null,
    }))

    const { error } = await supabase
      .from('items')
      .update({ checked: nextChecked })
      .eq('id', id)

    if (error) {
      // Per-item rollback: restore to prev state and surface error
      // SYNC-03: If offline, also set syncStatus to 'reconnecting' (belt-and-suspenders).
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? prev : i)),
        error: 'Failed to update item',
        syncStatus: !navigator.onLine ? 'reconnecting' : get().syncStatus,
      }))
    }
  },

  clearChecked: async (listId) => {
    // Snapshot BEFORE optimistic removal (Pitfall 4 — read before set())
    const checkedItems = get().items.filter((i) => i.checked)
    if (checkedItems.length === 0) return

    // Optimistic bulk remove — remove all checked items immediately
    set((state) => ({
      items: state.items.filter((i) => !i.checked),
      error: null,
    }))

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('list_id', listId)
      .eq('checked', true)

    if (error) {
      // Bulk rollback: restore removed items + error in single set() call (CR-02).
      // Dedup against current ids so a concurrent re-insert can't double an item (CR-01).
      // SYNC-03: If offline, also set syncStatus to 'reconnecting' (belt-and-suspenders).
      set((state) => {
        const present = new Set(state.items.map((i) => i.id))
        const restored = checkedItems.filter((i) => !present.has(i.id))
        return {
          items: [...state.items, ...restored],
          error: 'Failed to clear items',
          syncStatus: !navigator.onLine ? 'reconnecting' : get().syncStatus,
        }
      })
    }
  },

  subscribeToList: (listId: string) => {
    // Clean up any existing channel before creating a new one (StrictMode double-mount guard — D-09).
    // removeChannel is fire-and-forget here; a brief overlap with the new channel is safe because
    // the merge reducer is idempotent by id (a duplicate INSERT/UPDATE/DELETE event is a no-op) (WR-01).
    const existing = get().channel
    if (existing) supabase.removeChannel(existing)

    set({ syncStatus: 'connecting' })

    const channel = supabase
      .channel(`items-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          // Inline merge reducer — idempotent by id (D-03)
          const { eventType, new: newRow, old: oldRow } = payload
          set((state) => {
            if (eventType === 'INSERT') {
              // Upsert: no-op if id already present (own-write echo guard — D-03)
              const id = (newRow as Item).id
              if (state.items.some((i) => i.id === id)) return state
              // CR-01 fix: Check if this server row matches a pending optimistic item.
              // When Realtime INSERT arrives before the HTTP response, the temp ID is still
              // in the items array. Match by name to replace the optimistic item in-place.
              const tempEntry = [...pendingTempIds].find((tid) =>
                state.items.some((i) => i.id === tid && i.name === (newRow as Item).name)
              )
              if (tempEntry) {
                pendingTempIds.delete(tempEntry)
                return { items: state.items.map((i) => i.id === tempEntry ? (newRow as Item) : i) }
              }
              return { items: [...state.items, newRow as Item] }
            }
            if (eventType === 'UPDATE') {
              // WR-03 fix: Early return same reference when no item matches, avoiding
              // unnecessary re-renders. Mirrors the DELETE branch's defensive pattern.
              const updatedId = (newRow as Item).id
              // D-10 one-shot echo-skip: consume our own reorder UPDATE echo so the row
              // keeps its optimistic {category, position} (no flicker). Mirrors the
              // pendingTempIds consume-and-skip in the INSERT branch. A subsequent
              // partner UPDATE for the same id is not pending and merges normally below.
              if (pendingReorders.has(updatedId)) {
                pendingReorders.delete(updatedId)
                return state
              }
              if (!state.items.some((i) => i.id === updatedId)) return state
              return {
                items: state.items.map((i) =>
                  i.id === updatedId ? (newRow as Item) : i
                ),
              }
            }
            if (eventType === 'DELETE') {
              // payload.old contains only primary key when RLS is enabled (D-03 / RESEARCH §DELETE Payload)
              const deletedId = (oldRow as { id?: string }).id
              if (!deletedId) return state
              return { items: state.items.filter((i) => i.id !== deletedId) }
            }
            return state
          })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          set({ syncStatus: 'live' })
          // Guard keyed by listId so a re-subscribe to a DIFFERENT list is never skipped (CR-01)
          if (inFlightListId !== listId) {
            inFlightListId = listId
            // CR-02: Use background mode when items are already populated to avoid
            // clearing the visible list during re-fetches (screen wake, reconnect).
            const hasItems = get().items.length > 0
            get()
              .fetchItems(listId, { background: hasItems })
              .then(() => {
                if (inFlightListId === listId) inFlightListId = null
              })
              .catch(() => {
                // WR-01 fix: On failure, clear guard immediately so any subsequent
                // SUBSCRIBED callback can trigger a fresh fetch. Without this, a
                // SUBSCRIBED callback that fired (and was skipped) while this fetch
                // was in-flight would leave the user with stale/missing items and
                // no automatic recovery path.
                inFlightListId = null
              })
          }
        } else {
          // CHANNEL_ERROR, TIMED_OUT, CLOSED all map to reconnecting (D-08)
          set({ syncStatus: 'reconnecting' })
        }
      })

    set({ channel })
  },

  unsubscribe: () => {
    // Pattern 4: removeChannel deregisters from client registry (prevents duplicate handlers — D-09)
    const channel = get().channel
    if (channel) {
      supabase.removeChannel(channel)
      set({ channel: null, syncStatus: 'connecting' })
    }
  },
}))
