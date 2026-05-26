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

// Capture the subscribe callback so tests can trigger status strings directly.
// Use vi.hoisted() so these variables are available inside the vi.mock() factory
// (vi.mock is hoisted to the top of the file by Vitest, before variable declarations).
const { mockChannelOn, mockChannelSubscribe, mockRemoveChannel, getCapturedCb, resetCapturedCb } =
  vi.hoisted(() => {
    let _capturedSubscribeCb: ((status: string) => void) | null = null
    const _mockChannelOn = vi.fn().mockReturnThis()
    const _mockChannelSubscribe = vi.fn().mockImplementation((cb: (status: string) => void) => {
      _capturedSubscribeCb = cb
      return {}
    })
    const _mockRemoveChannel = vi.fn()
    return {
      mockChannelOn: _mockChannelOn,
      mockChannelSubscribe: _mockChannelSubscribe,
      mockRemoveChannel: _mockRemoveChannel,
      getCapturedCb: () => _capturedSubscribeCb,
      resetCapturedCb: () => { _capturedSubscribeCb = null },
    }
  })

// Convenience alias — updated by reset in beforeEach
let capturedSubscribeCb: ((status: string) => void) | null = null

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (_table: string) => createMockFrom(),
    channel: vi.fn().mockReturnValue({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    }),
    removeChannel: mockRemoveChannel,
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
      syncStatus: 'connecting',
      channel: null,
    })
    // Reset resolve overrides
    mockUpdateFn._resolvePromise = undefined
    mockDeleteFn._resolvePromise = undefined
    resetCapturedCb()
    capturedSubscribeCb = getCapturedCb()
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
    useItemsStore.setState({ items: [...seedItems], loading: false, error: null, syncStatus: 'connecting', channel: null })
    mockUpdateFn._resolvePromise = undefined
    mockDeleteFn._resolvePromise = undefined
    resetCapturedCb()
    capturedSubscribeCb = getCapturedCb()
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

// Seed items shared across SYNC describe blocks
const syncSeedItems = [
  {
    id: 'sync-item-1',
    list_id: 'list-sync',
    name: 'Apples',
    quantity: null,
    category: null,
    checked: false,
    added_by: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sync-item-2',
    list_id: 'list-sync',
    name: 'Bread',
    quantity: null,
    category: null,
    checked: false,
    added_by: null,
    created_at: new Date().toISOString(),
  },
]

describe('itemsStore — subscribeToList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: [...syncSeedItems],
      loading: false,
      error: null,
      syncStatus: 'connecting',
      channel: null,
    })
    resetCapturedCb()
    capturedSubscribeCb = getCapturedCb()
  })

  it('sets syncStatus to "live" and calls fetchItems when SUBSCRIBED fires (SYNC-02/03)', async () => {
    // Mock fetchItems so we can spy on it without real network calls
    const fetchItemsSpy = vi.fn().mockResolvedValue(undefined)
    useItemsStore.setState({ fetchItems: fetchItemsSpy } as Partial<Parameters<typeof useItemsStore.setState>[0]>)

    useItemsStore.getState().subscribeToList('list-sync')

    // Subscribe callback should have been captured by mockChannelSubscribe
    capturedSubscribeCb = getCapturedCb()
    expect(capturedSubscribeCb).not.toBeNull()

    // Fire SUBSCRIBED status
    capturedSubscribeCb!('SUBSCRIBED')

    // syncStatus must be 'live'
    expect(useItemsStore.getState().syncStatus).toBe('live')

    // fetchItems must have been called with listId
    expect(fetchItemsSpy).toHaveBeenCalledWith('list-sync')
  })

  it('sets syncStatus to "reconnecting" on CHANNEL_ERROR (SYNC-03)', () => {
    useItemsStore.getState().subscribeToList('list-sync')
    capturedSubscribeCb = getCapturedCb()
    capturedSubscribeCb!('CHANNEL_ERROR')
    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('sets syncStatus to "reconnecting" on TIMED_OUT (SYNC-03)', () => {
    useItemsStore.getState().subscribeToList('list-sync')
    capturedSubscribeCb = getCapturedCb()
    capturedSubscribeCb!('TIMED_OUT')
    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('sets syncStatus to "reconnecting" on CLOSED (SYNC-03)', () => {
    useItemsStore.getState().subscribeToList('list-sync')
    capturedSubscribeCb = getCapturedCb()
    capturedSubscribeCb!('CLOSED')
    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })
})

describe('itemsStore — unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: [...syncSeedItems],
      loading: false,
      error: null,
      syncStatus: 'connecting',
      channel: null,
    })
    resetCapturedCb()
    capturedSubscribeCb = getCapturedCb()
  })

  it('calls supabase.removeChannel with the active channel ref (SYNC-02)', () => {
    // Subscribe to establish a channel in state
    useItemsStore.getState().subscribeToList('list-sync')
    const channelRef = useItemsStore.getState().channel
    expect(channelRef).not.toBeNull()

    // Unsubscribe — should call removeChannel with the stored channel
    useItemsStore.getState().unsubscribe()
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelRef)
  })

  it('sets channel to null and syncStatus to "connecting" after unsubscribe (SYNC-02)', () => {
    useItemsStore.getState().subscribeToList('list-sync')
    expect(useItemsStore.getState().channel).not.toBeNull()
    expect(useItemsStore.getState().syncStatus).toBe('connecting') // still connecting before SUBSCRIBED fires

    useItemsStore.getState().unsubscribe()

    expect(useItemsStore.getState().channel).toBeNull()
    expect(useItemsStore.getState().syncStatus).toBe('connecting')
  })
})

describe('itemsStore — mergeReducer', () => {
  // Helper: get the postgres_changes payload callback registered via .on()
  function getPayloadCallback() {
    // mockChannelOn.mock.calls[0][2] is the third argument to .on() (the payload handler)
    const calls = mockChannelOn.mock.calls
    if (calls.length === 0) throw new Error('subscribeToList must be called before getPayloadCallback')
    return calls[calls.length - 1][2] as (payload: Record<string, unknown>) => void
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: [...syncSeedItems],
      loading: false,
      error: null,
      syncStatus: 'connecting',
      channel: null,
    })
    resetCapturedCb()
    capturedSubscribeCb = getCapturedCb()
    // Set up channel by calling subscribeToList (wires up .on() callback)
    useItemsStore.getState().subscribeToList('list-sync')
  })

  it('INSERT from partner: appends new item when id is absent (SYNC-01)', () => {
    const payloadCb = getPayloadCallback()
    const newItem = {
      id: 'sync-item-3',
      list_id: 'list-sync',
      name: 'Carrots',
      quantity: null,
      category: null,
      checked: false,
      added_by: null,
      created_at: new Date().toISOString(),
    }

    payloadCb({ eventType: 'INSERT', new: newItem, old: {} })

    const items = useItemsStore.getState().items
    expect(items).toHaveLength(3)
    expect(items.find((i) => i.id === 'sync-item-3')).toBeDefined()
  })

  it('INSERT echo: no-op when id already exists in items (SYNC-01)', () => {
    const payloadCb = getPayloadCallback()
    // Fire INSERT with an id already in the seed state
    payloadCb({
      eventType: 'INSERT',
      new: { ...syncSeedItems[0], name: 'Apples Echo' },
      old: {},
    })

    // Items array length must not change
    const items = useItemsStore.getState().items
    expect(items).toHaveLength(2)
    // Original item must be unchanged
    expect(items.find((i) => i.id === 'sync-item-1')?.name).toBe('Apples')
  })

  it('UPDATE from partner: replaces matching row by id (SYNC-01)', () => {
    const payloadCb = getPayloadCallback()
    const updatedItem = { ...syncSeedItems[0], name: 'Apples (updated)' }

    payloadCb({ eventType: 'UPDATE', new: updatedItem, old: syncSeedItems[0] })

    const items = useItemsStore.getState().items
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.id === 'sync-item-1')?.name).toBe('Apples (updated)')
  })

  it('DELETE from partner: removes item by id from payload.old (SYNC-01)', () => {
    const payloadCb = getPayloadCallback()
    // payload.old contains only the primary key (RLS behaviour)
    payloadCb({ eventType: 'DELETE', new: {}, old: { id: 'sync-item-2' } })

    const items = useItemsStore.getState().items
    expect(items).toHaveLength(1)
    expect(items.find((i) => i.id === 'sync-item-2')).toBeUndefined()
  })

  it('DELETE with only id in payload.old: handles partial old object safely (SYNC-01)', () => {
    const payloadCb = getPayloadCallback()
    // Simulate a DELETE where old only has id (RLS strips the rest)
    payloadCb({ eventType: 'DELETE', new: {}, old: { id: 'sync-item-1' } })

    const items = useItemsStore.getState().items
    expect(items).toHaveLength(1)
    expect(items.find((i) => i.id === 'sync-item-1')).toBeUndefined()
  })

  it('multiple DELETE events from clearChecked remove correct rows (SYNC-01)', () => {
    const payloadCb = getPayloadCallback()
    // Simulate two separate DELETE events (as clearChecked would produce)
    payloadCb({ eventType: 'DELETE', new: {}, old: { id: 'sync-item-1' } })
    payloadCb({ eventType: 'DELETE', new: {}, old: { id: 'sync-item-2' } })

    const items = useItemsStore.getState().items
    expect(items).toHaveLength(0)
  })
})
