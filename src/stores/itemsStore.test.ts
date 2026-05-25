import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useItemsStore } from './itemsStore'

// Chainable Supabase mock that supports:
// .from().update().eq() -> Promise (toggleChecked)
// .from().delete().eq().eq() -> Promise (clearChecked)
const mockUpdateFn = vi.fn()
const mockDeleteFn = vi.fn()
const mockEqFn = vi.fn()

function createMockFrom() {
  return {
    update: (changes: unknown) => {
      mockUpdateFn(changes)
      return {
        eq: (col: string, val: unknown) => {
          mockEqFn(col, val)
          return mockUpdateFn._resolvePromise ?? Promise.resolve({ data: null, error: null })
        },
      }
    },
    delete: () => {
      mockDeleteFn()
      return {
        eq: (col: string, val: unknown) => {
          mockEqFn(col, val)
          return {
            eq: (col2: string, val2: unknown) => {
              mockEqFn(col2, val2)
              return mockDeleteFn._resolvePromise ?? Promise.resolve({ data: null, error: null })
            },
          }
        },
      }
    },
  }
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (_table: string) => createMockFrom(),
  },
}))

describe('itemsStore — toggleChecked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state before each test
    useItemsStore.setState({
      items: [
        {
          id: 'item-1',
          list_id: 'list-1',
          name: 'Milk',
          quantity: null,
          category: null,
          checked: false,
          added_by: null,
          created_at: new Date().toISOString(),
        },
      ],
      loading: false,
      error: null,
    })
    // Reset resolve overrides
    mockUpdateFn._resolvePromise = undefined
    mockDeleteFn._resolvePromise = undefined
  })

  it('toggleChecked optimistic: immediately sets checked=true before Supabase resolves (SHOP-01)', async () => {
    // Use a promise that we control
    let resolveUpdate!: (value: unknown) => void
    const pendingPromise = new Promise((res) => { resolveUpdate = res })
    mockUpdateFn._resolvePromise = pendingPromise

    // Call toggleChecked without awaiting — we want to inspect optimistic state
    const togglePromise = useItemsStore.getState().toggleChecked('item-1')

    // Immediately after call, item should already be checked (optimistic)
    const items = useItemsStore.getState().items
    expect(items.find((i) => i.id === 'item-1')?.checked).toBe(true)

    // Now resolve the Supabase call and await the action
    resolveUpdate({ data: null, error: null })
    await togglePromise
  })

  it('toggleChecked rollback: restores checked=false and sets error when Supabase returns an error (SHOP-01/02)', async () => {
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'DB error' } })

    await useItemsStore.getState().toggleChecked('item-1')

    const state = useItemsStore.getState()
    // Item should be rolled back to unchecked
    expect(state.items.find((i) => i.id === 'item-1')?.checked).toBe(false)
    // Error should be set
    expect(state.error).toBe('Failed to update item')
  })

  it('toggleChecked both directions: calling twice cycles false→true→false (SHOP-02)', async () => {
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // First toggle: false → true
    await useItemsStore.getState().toggleChecked('item-1')
    expect(useItemsStore.getState().items.find((i) => i.id === 'item-1')?.checked).toBe(true)

    // Reset mock resolve for second call
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // Second toggle: true → false
    await useItemsStore.getState().toggleChecked('item-1')
    expect(useItemsStore.getState().items.find((i) => i.id === 'item-1')?.checked).toBe(false)
  })
})
