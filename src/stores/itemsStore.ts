import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/item'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Module-level in-flight guard: prevents redundant fetchItems calls when
// visibilitychange + online + SUBSCRIBED fire near-simultaneously (RESEARCH §Resync Guard)
let fetchInFlight = false

interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
  syncStatus: 'connecting' | 'live' | 'reconnecting'
  channel: RealtimeChannel | null

  fetchItems: (listId: string) => Promise<void>
  addItem: (
    listId: string,
    name: string,
    quantity?: string,
    category?: string,
    addedBy?: string
  ) => Promise<void>
  updateItem: (
    id: string,
    changes: Partial<Pick<Item, 'name' | 'quantity' | 'category'>>
  ) => Promise<void>
  deleteItem: (id: string) => Promise<void>
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

  fetchItems: async (listId) => {
    set({ loading: true, error: null })
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

  addItem: async (listId, name, quantity, category, addedBy) => {
    const tempId = nanoid()
    const optimisticItem: Item = {
      id: tempId,
      list_id: listId,
      name,
      quantity: quantity || null,
      category: category || null,
      checked: false,
      added_by: addedBy || null,
      created_at: new Date().toISOString(),
    }

    // Optimistic add — append to items array
    set((state) => ({ items: [...state.items, optimisticItem] }))

    const { data, error } = await supabase
      .from('items')
      .insert({
        list_id: listId,
        name,
        quantity: quantity || null,
        category: category || null,
        added_by: addedBy || null,
      })
      .select()
      .single()

    if (error) {
      // Per-item rollback: remove only the optimistic item by its temp ID
      // and surface an error so the UI can notify the user (CR-02).
      set((state) => ({
        items: state.items.filter((i) => i.id !== tempId),
        error: 'Failed to add item',
      }))
    } else if (data) {
      // Replace temp item with real DB row (gets the server-generated ID)
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
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? prev : i)),
        error: 'Failed to update item',
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
      set((state) => ({ items: [...state.items, prev], error: 'Failed to delete item' }))
    }
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
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? prev : i)),
        error: 'Failed to update item',
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
      set((state) => {
        const present = new Set(state.items.map((i) => i.id))
        const restored = checkedItems.filter((i) => !present.has(i.id))
        return {
          items: [...state.items, ...restored],
          error: 'Failed to clear items',
        }
      })
    }
  },

  subscribeToList: (listId: string) => {
    // Clean up any existing channel before creating a new one (StrictMode double-mount guard — D-09)
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
              return { items: [...state.items, newRow as Item] }
            }
            if (eventType === 'UPDATE') {
              return {
                items: state.items.map((i) =>
                  i.id === (newRow as Item).id ? (newRow as Item) : i
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
          // fetchInFlight guard: prevents redundant fetches when visibilitychange + online +
          // SUBSCRIBED all fire simultaneously (RESEARCH §Resync Guard)
          if (!fetchInFlight) {
            fetchInFlight = true
            get().fetchItems(listId).finally(() => { fetchInFlight = false })
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
