import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useItemsStore } from './itemsStore'

// Chainable Supabase mock that supports:
// .from().update().eq() -> Promise (toggleChecked)
// .from().delete().eq().eq() -> Promise (clearChecked)
type ResolvableMock = ReturnType<typeof vi.fn> & { _resolvePromise?: unknown }
const mockUpdateFn = vi.fn() as ResolvableMock
const mockDeleteFn = vi.fn() as ResolvableMock
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

describe('itemsStore — clearChecked', () => {
  // Seed items: one unchecked, two checked
  const seedItems = [
    {
      id: 'item-A',
      list_id: 'list-1',
      name: 'Apples',
      quantity: null,
      category: null,
      checked: false,
      added_by: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'item-B',
      list_id: 'list-1',
      name: 'Bananas',
      quantity: null,
      category: null,
      checked: true,
      added_by: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'item-C',
      list_id: 'list-1',
      name: 'Carrots',
      quantity: null,
      category: null,
      checked: true,
      added_by: null,
      created_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({ items: [...seedItems], loading: false, error: null })
    mockUpdateFn._resolvePromise = undefined
    mockDeleteFn._resolvePromise = undefined
  })

  it('clearChecked optimistic: immediately removes only checked items before Supabase resolves (SHOP-03)', async () => {
    // Use a promise we control so we can inspect optimistic state
    let resolveDelete!: (value: unknown) => void
    const pendingPromise = new Promise((res) => { resolveDelete = res })
    mockDeleteFn._resolvePromise = pendingPromise

    // Call without awaiting — inspect optimistic state synchronously
    const clearPromise = useItemsStore.getState().clearChecked('list-1')

    // After the call, only unchecked item-A should remain
    const items = useItemsStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('item-A')

    // Resolve Supabase and await
    resolveDelete({ data: null, error: null })
    await clearPromise
  })

  it('clearChecked rollback: restores all checked items and sets error when Supabase returns an error (SHOP-03 rollback)', async () => {
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'DB error' } })

    await useItemsStore.getState().clearChecked('list-1')

    const state = useItemsStore.getState()
    // All 3 items should be restored
    expect(state.items).toHaveLength(3)
    expect(state.items.find((i) => i.id === 'item-B')).toBeDefined()
    expect(state.items.find((i) => i.id === 'item-C')).toBeDefined()
    // Error message must match exactly
    expect(state.error).toBe('Failed to clear items')
  })

  it('clearChecked no-op: does not call Supabase when no items are checked (early return guard)', async () => {
    // Reset state to all-unchecked
    useItemsStore.setState({
      items: [{ ...seedItems[0], checked: false }],
      loading: false,
      error: null,
    })

    await useItemsStore.getState().clearChecked('list-1')

    // Supabase delete should NOT have been called
    expect(mockDeleteFn).not.toHaveBeenCalled()
    // Items unchanged
    expect(useItemsStore.getState().items).toHaveLength(1)
  })
})
