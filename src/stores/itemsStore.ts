import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/item'

interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null

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
}

export const useItemsStore = create<ItemsState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

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
    const tempId = crypto.randomUUID()
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
      set((state) => ({
        items: state.items.filter((i) => i.id !== tempId),
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
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? prev : i)),
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
      set((state) => ({ items: [...state.items, prev] }))
    }
  },
}))
