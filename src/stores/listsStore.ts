import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import type { List } from '@/types/list'

interface ListsState {
  lists: List[]
  loading: boolean
  error: string | null

  fetchLists: (userId: string) => Promise<void>
  createList: (name: string, userId: string) => Promise<string>
  renameList: (id: string, name: string) => Promise<void>
  deleteList: (id: string) => Promise<void>
}

export const useListsStore = create<ListsState>()((set, get) => ({
  lists: [],
  loading: false,
  error: null,

  fetchLists: async (userId) => {
    set({ loading: true, error: null })

    const { data, error } = await supabase
      .from('lists')
      .select('id, name, share_code, owner_id, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      set({ error: 'Failed to load lists', loading: false })
    } else {
      set({ lists: data ?? [], loading: false })
    }
  },

  createList: async (name, userId) => {
    const trimmed = name.trim()
    if (!trimmed) {
      set({ error: 'Failed to create list' })
      return ''
    }

    const tempId = nanoid()
    const shareCode = nanoid(8)

    const optimisticList: List = {
      id: tempId,
      name: trimmed,
      share_code: shareCode,
      owner_id: userId,
      created_at: new Date().toISOString(),
    }

    // Optimistic add — prepend so newest appears first
    set((state) => ({ lists: [optimisticList, ...state.lists] }))

    const { data, error } = await supabase
      .from('lists')
      .insert({ name: trimmed, share_code: shareCode, owner_id: userId })
      .select()
      .single()

    // Treat a null row (insert error OR RLS returning no row) as failure:
    // returning the optimistic temp code would navigate to a list that does not exist.
    if (error || !data) {
      // Rollback: remove the optimistic row and surface error
      set((state) => ({
        lists: state.lists.filter((l) => l.id !== tempId),
        error: 'Failed to create list',
      }))
      return ''
    }

    // Replace temp row with real DB row
    set((state) => ({
      lists: state.lists.map((l) => (l.id === tempId ? data : l)),
    }))
    return data.share_code
  },

  renameList: async (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      set({ error: 'Failed to rename list' })
      return
    }

    // CRITICAL: snapshot BEFORE set() (Pitfall 4 — read before set())
    const prev = get().lists.find((l) => l.id === id)
    if (!prev) return

    // Optimistic name update
    set((state) => ({
      lists: state.lists.map((l) => (l.id === id ? { ...l, name: trimmed } : l)),
    }))

    const { error } = await supabase
      .from('lists')
      .update({ name: trimmed })
      .eq('id', id)

    if (error) {
      // Rollback: restore previous name
      set((state) => ({
        lists: state.lists.map((l) => (l.id === id ? prev : l)),
        error: 'Failed to rename list',
      }))
    }
  },

  deleteList: async (id) => {
    // CRITICAL: snapshot BEFORE set() (Pitfall 4 — read before set())
    const prev = get().lists.find((l) => l.id === id)
    if (!prev) return

    // Optimistic delete: remove from list
    set((state) => ({
      lists: state.lists.filter((l) => l.id !== id),
    }))

    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', id)

    if (error) {
      // Rollback: re-insert the deleted row
      set((state) => ({
        lists: [...state.lists, prev],
        error: 'Failed to delete list',
      }))
    }
  },
}))
