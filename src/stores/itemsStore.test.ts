import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useItemsStore } from './itemsStore'

// Chainable Supabase mock that supports:
// .from().update().eq() -> Promise (toggleChecked)
// .from().delete().eq().eq() -> Promise (clearChecked)
// .from().insert().select().single() -> Promise (addItem)
// .from().select().eq().order() -> Promise (fetchItems)
type ResolvableMock = ReturnType<typeof vi.fn> & { _resolvePromise?: Promise<unknown> }
const mockUpdateFn = vi.fn() as ResolvableMock
const mockDeleteFn = vi.fn() as ResolvableMock
const mockInsertFn = vi.fn() as ResolvableMock
const mockFetchFn = vi.fn() as ResolvableMock
const mockEqFn = vi.fn()

function createMockFrom() {
  return {
    insert: (data: unknown) => {
      mockInsertFn(data)
      return {
        select: () => ({
          single: () => mockInsertFn._resolvePromise ?? Promise.resolve({ data: null, error: null }),
        }),
      }
    },
    select: () => ({
      eq: (col: string, val: unknown) => {
        mockEqFn(col, val)
        return {
          order: () => mockFetchFn._resolvePromise ?? Promise.resolve({ data: [], error: null }),
        }
      },
    }),
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
          // Return an object that is both thenable (for single-eq chains like deleteItem)
          // and has .eq() for double-eq chains like clearChecked
          const resolvedPromise = mockDeleteFn._resolvePromise ?? Promise.resolve({ data: null, error: null })
          return {
            eq: (col2: string, val2: unknown) => {
              mockEqFn(col2, val2)
              return resolvedPromise
            },
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              resolvedPromise.then(resolve, reject),
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
          user_id: null,
          created_at: new Date().toISOString(),
          note: null,
          position: null,
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
      user_id: null,
      created_at: new Date().toISOString(),
      note: null,
      position: null,
    },
    {
      id: 'item-B',
      list_id: 'list-1',
      name: 'Bananas',
      quantity: null,
      category: null,
      checked: true,
      added_by: null,
      user_id: null,
      created_at: new Date().toISOString(),
      note: null,
      position: null,
    },
    {
      id: 'item-C',
      list_id: 'list-1',
      name: 'Carrots',
      quantity: null,
      category: null,
      checked: true,
      added_by: null,
      user_id: null,
      created_at: new Date().toISOString(),
      note: null,
      position: null,
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
    user_id: null,
    created_at: new Date().toISOString(),
    note: null,
    position: null,
  },
  {
    id: 'sync-item-2',
    list_id: 'list-sync',
    name: 'Bread',
    quantity: null,
    category: null,
    checked: false,
    added_by: null,
    user_id: null,
    created_at: new Date().toISOString(),
    note: null,
    position: null,
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
    expect(fetchItemsSpy).toHaveBeenCalledWith('list-sync', { background: true })
  })

  it('re-subscribe to a different list is not skipped while the prior list fetch is in flight (CR-01)', () => {
    // fetchItems stays pending so the in-flight guard remains set for the first list.
    // With a boolean guard this would skip list-b; the listId-keyed guard must allow it.
    const fetchItemsSpy = vi.fn().mockReturnValue(new Promise<void>(() => {}))
    useItemsStore.setState({ fetchItems: fetchItemsSpy } as Partial<Parameters<typeof useItemsStore.setState>[0]>)

    useItemsStore.getState().subscribeToList('list-a')
    getCapturedCb()!('SUBSCRIBED')
    expect(fetchItemsSpy).toHaveBeenCalledWith('list-a', { background: true })

    // Different list while list-a's fetch is still pending — must NOT be skipped
    useItemsStore.getState().subscribeToList('list-b')
    getCapturedCb()!('SUBSCRIBED')
    expect(fetchItemsSpy).toHaveBeenCalledWith('list-b', { background: true })
    expect(fetchItemsSpy).toHaveBeenCalledTimes(2)
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

  it('UPDATE from partner: merges a note edit into the existing row (ITEM-01 note sync)', () => {
    // A partner adds a note to an item that is NOT pending in this client.
    // The note must ride the existing replace-row-by-id reducer (no new subscription).
    const payloadCb = getPayloadCallback()
    const withNote = { ...syncSeedItems[0], note: 'organic' }

    payloadCb({ eventType: 'UPDATE', new: withNote, old: syncSeedItems[0] })

    const items = useItemsStore.getState().items
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.id === 'sync-item-1')?.note).toBe('organic')
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

describe('itemsStore — mutation offline syncStatus guard', () => {
  const seedItem = {
    id: 'offline-item-1',
    list_id: 'list-offline',
    name: 'Milk',
    quantity: null,
    category: null,
    checked: false,
    added_by: 'Test',
    user_id: null,
    created_at: new Date().toISOString(),
    note: null,
    position: null,
  }

  const checkedSeedItem = {
    ...seedItem,
    id: 'offline-item-2',
    checked: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: [{ ...seedItem }, { ...checkedSeedItem }],
      loading: false,
      error: null,
      syncStatus: 'live',
      channel: null,
    })
    mockUpdateFn._resolvePromise = undefined
    mockDeleteFn._resolvePromise = undefined
    mockInsertFn._resolvePromise = undefined
    mockFetchFn._resolvePromise = undefined
    resetCapturedCb()
  })

  afterEach(() => {
    // Restore ONLY the per-test navigator.onLine getter spy. vi.restoreAllMocks()
    // here is too broad — it strips the module-level supabase.channel() mockReturnValue,
    // which breaks the later reorderItem echo-skip test that calls subscribeToList.
    vi.spyOn(navigator, 'onLine', 'get').mockRestore()
  })

  it('addItem error + offline sets syncStatus to "reconnecting" (SYNC-03)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    mockInsertFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'net err' } })

    await useItemsStore.getState().addItem('list-offline', 'Bread')

    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('updateItem error + offline sets syncStatus to "reconnecting" (SYNC-03)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'net err' } })

    await useItemsStore.getState().updateItem('offline-item-1', { name: 'Almond Milk' })

    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('deleteItem error + offline sets syncStatus to "reconnecting" (SYNC-03)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'net err' } })

    await useItemsStore.getState().deleteItem('offline-item-1')

    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('toggleChecked error + offline sets syncStatus to "reconnecting" (SYNC-03)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'net err' } })

    await useItemsStore.getState().toggleChecked('offline-item-1')

    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('clearChecked error + offline sets syncStatus to "reconnecting" (SYNC-03)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'net err' } })

    await useItemsStore.getState().clearChecked('list-offline')

    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('mutation error + online does NOT change syncStatus to "reconnecting" (SYNC-03)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'net err' } })

    await useItemsStore.getState().toggleChecked('offline-item-1')

    // syncStatus should remain 'live' (not changed to 'reconnecting')
    expect(useItemsStore.getState().syncStatus).toBe('live')
  })
})

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, ITEM-01/02): reorderItem + pendingReorders echo-skip.
// `reorderItem` does not exist on the store yet — these calls throw at runtime
// until the action lands in itemsStore.ts (Wave 1). The contracts pinned here:
//   (a) cross-category optimistic write: a SINGLE update carries {category, position}
//   (b) rollback on error: reverts position+category, sets 'Failed to reorder item'
//   (c) pendingReorders one-shot echo-skip: own UPDATE echo is consumed, no flicker;
//       a subsequent partner UPDATE for the same id still merges
// ──────────────────────────────────────────────────────────────────────────

// Typed access to the not-yet-existing reorder action (RED until Wave 1).
type StoreWithReorder = ReturnType<typeof useItemsStore.getState> & {
  reorderItem: (activeId: string, overId: string) => Promise<void>
}
function reorder(activeId: string, overId: string): Promise<void> {
  return (useItemsStore.getState() as StoreWithReorder).reorderItem(activeId, overId)
}

describe('itemsStore — reorderItem (ITEM-02)', () => {
  // Two categories so we can exercise a cross-category drop.
  const reorderSeed = [
    {
      id: 'r-produce-1', list_id: 'list-r', name: 'Apples', quantity: null,
      category: 'Produce', checked: false, added_by: null, user_id: null,
      created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1',
    },
    {
      id: 'r-produce-2', list_id: 'list-r', name: 'Bananas', quantity: null,
      category: 'Produce', checked: false, added_by: null, user_id: null,
      created_at: '2026-01-01T00:01:00Z', note: null, position: 'a2',
    },
    {
      id: 'r-dairy-1', list_id: 'list-r', name: 'Milk', quantity: null,
      category: 'Dairy', checked: false, added_by: null, user_id: null,
      created_at: '2026-01-01T00:02:00Z', note: null, position: 'a1',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: reorderSeed.map((i) => ({ ...i })),
      loading: false,
      error: null,
      syncStatus: 'live',
      channel: null,
    })
    mockUpdateFn._resolvePromise = undefined
    resetCapturedCb()
  })

  it('cross-category optimistic: writes {category, position} in a SINGLE update and adopts target category', async () => {
    // Hold the update open so we can inspect the optimistic state before it resolves.
    let resolveUpdate!: (value: unknown) => void
    const pending = new Promise((res) => { resolveUpdate = res })
    mockUpdateFn._resolvePromise = pending

    // Drag a Produce item onto a Dairy item — should adopt 'Dairy' + a new position.
    const p = reorder('r-produce-1', 'r-dairy-1')

    const dragged = useItemsStore.getState().items.find((i) => i.id === 'r-produce-1')!
    // Optimistic category adoption (cross-category).
    expect(dragged.category).toBe('Dairy')
    // Position changed off its original 'a1'.
    expect(dragged.position).not.toBe('a1')

    // Exactly one supabase update, carrying BOTH category and position together.
    expect(mockUpdateFn).toHaveBeenCalledTimes(1)
    const changes = mockUpdateFn.mock.calls[0][0] as Record<string, unknown>
    expect(changes).toHaveProperty('category', 'Dairy')
    expect(changes).toHaveProperty('position')
    expect(typeof changes.position).toBe('string')

    resolveUpdate({ data: null, error: null })
    await p
  })

  it('rollback on error: reverts position + category and sets "Failed to reorder item"', async () => {
    const prev = useItemsStore.getState().items.find((i) => i.id === 'r-produce-1')!
    const prevPosition = prev.position
    const prevCategory = prev.category
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'DB error' } })

    await reorder('r-produce-1', 'r-dairy-1')

    const after = useItemsStore.getState().items.find((i) => i.id === 'r-produce-1')!
    expect(after.position).toBe(prevPosition)
    expect(after.category).toBe(prevCategory)
    expect(useItemsStore.getState().error).toBe('Failed to reorder item')
  })

  it('pendingReorders one-shot echo-skip: own UPDATE echo is consumed (no flicker), next partner UPDATE still merges', async () => {
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // Wire the realtime channel so we can fire UPDATE payloads through the reducer.
    useItemsStore.getState().subscribeToList('list-r')
    const onCalls = mockChannelOn.mock.calls
    const payloadCb = onCalls[onCalls.length - 1][2] as (p: Record<string, unknown>) => void

    // Perform an optimistic reorder — leaves the id in pendingReorders on success.
    await reorder('r-produce-1', 'r-dairy-1')
    const optimistic = useItemsStore.getState().items.find((i) => i.id === 'r-produce-1')!
    const optimisticPosition = optimistic.position
    const optimisticCategory = optimistic.category

    // Fire the OWN echo carrying a STALE position — it must be consumed and skipped.
    payloadCb({
      eventType: 'UPDATE',
      new: { ...optimistic, position: 'STALE', category: 'STALE_CAT' },
      old: optimistic,
    })

    const afterEcho = useItemsStore.getState().items.find((i) => i.id === 'r-produce-1')!
    // State unchanged — the optimistic values survived (no flicker).
    expect(afterEcho.position).toBe(optimisticPosition)
    expect(afterEcho.category).toBe(optimisticCategory)

    // A SUBSEQUENT UPDATE for the same id (a real partner edit) merges normally
    // because the one-shot guard was already consumed.
    payloadCb({
      eventType: 'UPDATE',
      new: { ...afterEcho, note: 'partner note' },
      old: afterEcho,
    })
    const afterPartner = useItemsStore.getState().items.find((i) => i.id === 'r-produce-1')!
    expect(afterPartner.note).toBe('partner note')
  })
})
