import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useItemsStore } from './itemsStore'

// QOL-03 (D-12): toggleChecked fires triggerHaptic on the check-ON transition only.
// Mock the module so we can assert call/no-call without touching navigator.vibrate.
// RED until @/lib/haptics exists (Wave 1) AND toggleChecked imports + calls it.
const mockTriggerHaptic = vi.fn()
vi.mock('@/lib/haptics', () => ({
  triggerHaptic: (...args: unknown[]) => mockTriggerHaptic(...args),
}))

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
      // Single resolved promise shared by BOTH the .select().single() chain (addItem)
      // and the direct-thenable array-insert path (undoClear's `.from('items').insert(buffered)`
      // with no .select()). The _resolvePromise override hook lets error-path tests force
      // an { error } result for either path.
      const resolved =
        mockInsertFn._resolvePromise ?? Promise.resolve({ data: null, error: null })
      return {
        select: () => ({
          single: () => resolved,
        }),
        // Array insert is directly awaitable: `await supabase.from('items').insert(array)`
        // resolves the same { data, error } promise (undoClear).
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          resolved.then(resolve, reject),
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
    mockInsertFn._resolvePromise = undefined
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

  it('CR-01 upward drag: dropping a lower item ONTO a higher item lands it ABOVE the target', async () => {
    // Three items in Produce, ascending positions a1 < a2 < a3.
    useItemsStore.setState({
      items: [
        { id: 'up-1', list_id: 'list-r', name: 'A', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1' },
        { id: 'up-2', list_id: 'list-r', name: 'B', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:01:00Z', note: null, position: 'a2' },
        { id: 'up-3', list_id: 'list-r', name: 'C', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:02:00Z', note: null, position: 'a3' },
      ],
      loading: false, error: null, syncStatus: 'live', channel: null,
    })
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // Drag C (index 2, pos a3) UPWARD onto A (index 0, pos a1).
    // User intent: land C ABOVE A → new key must sort BEFORE 'a1'.
    await reorder('up-3', 'up-1')

    const moved = useItemsStore.getState().items.find((i) => i.id === 'up-3')!
    expect(moved.position! < 'a1').toBe(true)
  })

  it('CR-01 downward drag: dropping a higher item ONTO a lower item lands it BELOW the target', async () => {
    useItemsStore.setState({
      items: [
        { id: 'dn-1', list_id: 'list-r', name: 'A', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1' },
        { id: 'dn-2', list_id: 'list-r', name: 'B', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:01:00Z', note: null, position: 'a2' },
        { id: 'dn-3', list_id: 'list-r', name: 'C', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:02:00Z', note: null, position: 'a3' },
      ],
      loading: false, error: null, syncStatus: 'live', channel: null,
    })
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // Drag A (index 0) DOWNWARD onto B (index 1): land BELOW B → between a2 and a3.
    await reorder('dn-1', 'dn-2')

    const moved = useItemsStore.getState().items.find((i) => i.id === 'dn-1')!
    expect(moved.position! > 'a2').toBe(true)
    expect(moved.position! < 'a3').toBe(true)
  })

  it('CR-02 duplicate positions: reorder between equal-position neighbors does NOT throw/silently no-op', async () => {
    // Two items in the SAME category share the SAME position (concurrent-add collision).
    // A reorder whose neighbors straddle them must NOT throw (silent abort); it must
    // apply an optimistic move and write through.
    useItemsStore.setState({
      items: [
        { id: 'dup-1', list_id: 'list-r', name: 'A', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1' },
        { id: 'dup-2', list_id: 'list-r', name: 'B', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:01:00Z', note: null, position: 'a2' },
        { id: 'dup-3', list_id: 'list-r', name: 'C', quantity: null, category: 'Produce', checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:02:00Z', note: null, position: 'a2' },
      ],
      loading: false, error: null, syncStatus: 'live', channel: null,
    })
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // Drag A downward onto B (the first of the two equal-position rows).
    await expect(reorder('dup-1', 'dup-2')).resolves.toBeUndefined()

    // Optimistic move applied + a single combined write — no silent no-op, no thrown error.
    const moved = useItemsStore.getState().items.find((i) => i.id === 'dup-1')!
    expect(typeof moved.position).toBe('string')
    expect(mockUpdateFn).toHaveBeenCalledTimes(1)
    expect(useItemsStore.getState().error).toBeNull()
  })

  it('WR-01 addItem under rapid double-add: two synchronous adds get DISTINCT position keys', async () => {
    useItemsStore.setState({
      items: [
        { id: 'seed', list_id: 'list-r', name: 'Seed', quantity: null, category: null, checked: false, added_by: null, user_id: null, created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1' },
      ],
      loading: false, error: null, syncStatus: 'live', channel: null,
    })
    // Insert resolves with null data so the optimistic item stays in place by temp id.
    mockInsertFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // Fire two adds in the SAME tick (no await between) — the WR-01 collision scenario.
    const p1 = useItemsStore.getState().addItem('list-r', 'X')
    const p2 = useItemsStore.getState().addItem('list-r', 'Y')
    await Promise.all([p1, p2])

    const positions = useItemsStore.getState().items.map((i) => i.position)
    const uniquePositions = new Set(positions)
    // No two items share a position key (the duplicate-key bug feeding CR-02).
    expect(uniquePositions.size).toBe(positions.length)
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

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, SHOP-05): clearChecked snapshot → lastCleared, undoClear, clearLastCleared.
// `lastCleared`, `undoClear`, `clearLastCleared` do not exist on the store yet — these
// fail (undefined field / not-a-function) until they land in itemsStore.ts (Wave 1).
// Contracts pinned (D-01, Pattern 1):
//   (a) clearChecked stores the pre-delete snapshot in lastCleared (SC-1)
//   (b) undoClear re-inserts buffered rows PRESERVING original ids, dedups by id,
//       empties lastCleared after, and rolls back on insert error
//   (c) clearLastCleared empties the buffer without a network call
// ──────────────────────────────────────────────────────────────────────────

// Typed access to the not-yet-existing undo surface (RED until Wave 1).
type StoreWithUndo = ReturnType<typeof useItemsStore.getState> & {
  lastCleared: Item[]
  undoClear: () => Promise<void>
  clearLastCleared: () => void
}
function undoStore(): StoreWithUndo {
  return useItemsStore.getState() as StoreWithUndo
}

describe('itemsStore — undoClear (SHOP-05)', () => {
  const undoSeed = [
    {
      id: 'u-A', list_id: 'list-u', name: 'Apples', quantity: null, category: null,
      checked: false, added_by: null, user_id: null,
      created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1',
    },
    {
      id: 'u-B', list_id: 'list-u', name: 'Bananas', quantity: null, category: 'Produce',
      checked: true, added_by: null, user_id: null,
      created_at: '2026-01-01T00:01:00Z', note: 'ripe', position: 'a2',
    },
    {
      id: 'u-C', list_id: 'list-u', name: 'Carrots', quantity: '3', category: 'Produce',
      checked: true, added_by: null, user_id: null,
      created_at: '2026-01-01T00:02:00Z', note: null, position: 'a3',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: undoSeed.map((i) => ({ ...i })),
      loading: false,
      error: null,
      syncStatus: 'live',
      channel: null,
      lastCleared: [],
    } as Partial<Parameters<typeof useItemsStore.setState>[0]>)
    mockUpdateFn._resolvePromise = undefined
    mockDeleteFn._resolvePromise = undefined
    mockInsertFn._resolvePromise = undefined
    resetCapturedCb()
  })

  it('clearChecked snapshots the pre-delete checked rows into lastCleared (D-01)', async () => {
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: null })

    await useItemsStore.getState().clearChecked('list-u')

    const buffered = undoStore().lastCleared
    expect(buffered.map((i) => i.id).sort()).toEqual(['u-B', 'u-C'])
    // The snapshot preserves full row content (so undoClear can re-insert faithfully).
    expect(buffered.find((i) => i.id === 'u-B')?.note).toBe('ripe')
    expect(buffered.find((i) => i.id === 'u-C')?.quantity).toBe('3')
  })

  it('undoClear re-adds buffered rows PRESERVING original ids and empties lastCleared', async () => {
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: null })
    mockInsertFn._resolvePromise = Promise.resolve({ data: null, error: null })

    await useItemsStore.getState().clearChecked('list-u')
    // After clear: only the unchecked u-A remains, buffer holds u-B + u-C.
    expect(useItemsStore.getState().items.map((i) => i.id)).toEqual(['u-A'])

    await undoStore().undoClear()

    const ids = useItemsStore.getState().items.map((i) => i.id).sort()
    expect(ids).toEqual(['u-A', 'u-B', 'u-C'])
    // Original ids preserved (not regenerated).
    expect(useItemsStore.getState().items.find((i) => i.id === 'u-B')).toBeDefined()
    expect(useItemsStore.getState().items.find((i) => i.id === 'u-C')).toBeDefined()
    // Buffer emptied after a successful undo (snackbar disappears).
    expect(undoStore().lastCleared).toEqual([])
    // The re-insert carried the original ids (Open Question A1 → .insert(buffered)).
    const insertArg = mockInsertFn.mock.calls.at(-1)?.[0] as Array<{ id: string }> | undefined
    expect(Array.isArray(insertArg)).toBe(true)
    expect(insertArg!.map((r) => r.id).sort()).toEqual(['u-B', 'u-C'])
  })

  it('undoClear dedups by id: a row already re-present (INSERT echo) is NOT duplicated (Pitfall 1)', async () => {
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: null })
    mockInsertFn._resolvePromise = Promise.resolve({ data: null, error: null })

    await useItemsStore.getState().clearChecked('list-u')
    // Simulate a Realtime INSERT echo landing u-B back BEFORE undoClear runs.
    useItemsStore.setState((s) => ({
      items: [...s.items, undoSeed.find((i) => i.id === 'u-B')!],
    }))

    await undoStore().undoClear()

    const bCount = useItemsStore.getState().items.filter((i) => i.id === 'u-B').length
    expect(bCount).toBe(1)
  })

  it('undoClear rolls back (removes the buffered ids) and sets an error on insert failure', async () => {
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: null })
    mockInsertFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'DB error' } })

    await useItemsStore.getState().clearChecked('list-u')
    await undoStore().undoClear()

    // Buffered rows must NOT linger in items after a failed re-insert.
    const ids = useItemsStore.getState().items.map((i) => i.id)
    expect(ids).not.toContain('u-B')
    expect(ids).not.toContain('u-C')
    expect(useItemsStore.getState().error).toBeTruthy()
  })

  it('clearLastCleared empties the buffer without a network insert', async () => {
    mockDeleteFn._resolvePromise = Promise.resolve({ data: null, error: null })
    await useItemsStore.getState().clearChecked('list-u')
    expect(undoStore().lastCleared.length).toBeGreaterThan(0)

    undoStore().clearLastCleared()

    expect(undoStore().lastCleared).toEqual([])
    expect(mockInsertFn).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, SHOP-06): uncheckAll. `uncheckAll` does not exist on the store yet —
// these fail (not-a-function) until it lands in itemsStore.ts (Wave 1).
// Contracts pinned (D-04, Pattern 2):
//   (a) optimistic: every checked item flips checked:false immediately
//   (b) ONE filtered update (.update({checked:false}).eq(list_id).eq(checked,true))
//   (c) bulk rollback of the snapshotted ids on error
//   (d) does NOT route through pendingReorders (Pitfall 3) — two UPDATE echoes for
//       one id yield one stable result
// ──────────────────────────────────────────────────────────────────────────

type StoreWithUncheck = ReturnType<typeof useItemsStore.getState> & {
  uncheckAll: (listId: string) => Promise<void>
}
function uncheckStore(): StoreWithUncheck {
  return useItemsStore.getState() as StoreWithUncheck
}

describe('itemsStore — uncheckAll (SHOP-06)', () => {
  const uncheckSeed = [
    {
      id: 'k-A', list_id: 'list-k', name: 'Apples', quantity: null, category: null,
      checked: false, added_by: null, user_id: null,
      created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1',
    },
    {
      id: 'k-B', list_id: 'list-k', name: 'Bananas', quantity: null, category: null,
      checked: true, added_by: null, user_id: null,
      created_at: '2026-01-01T00:01:00Z', note: null, position: 'a2',
    },
    {
      id: 'k-C', list_id: 'list-k', name: 'Carrots', quantity: null, category: null,
      checked: true, added_by: null, user_id: null,
      created_at: '2026-01-01T00:02:00Z', note: null, position: 'a3',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: uncheckSeed.map((i) => ({ ...i })),
      loading: false,
      error: null,
      syncStatus: 'live',
      channel: null,
    })
    mockUpdateFn._resolvePromise = undefined
    resetCapturedCb()
  })

  it('optimistic: flips every checked item to checked:false before Supabase resolves', async () => {
    let resolveUpdate!: (value: unknown) => void
    const pending = new Promise((res) => { resolveUpdate = res })
    mockUpdateFn._resolvePromise = pending

    const p = uncheckStore().uncheckAll('list-k')

    const items = useItemsStore.getState().items
    expect(items.every((i) => !i.checked)).toBe(true)

    resolveUpdate({ data: null, error: null })
    await p
  })

  it('issues a SINGLE filtered update: .update({checked:false}).eq(list_id).eq(checked,true)', async () => {
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    await uncheckStore().uncheckAll('list-k')

    expect(mockUpdateFn).toHaveBeenCalledTimes(1)
    expect(mockUpdateFn).toHaveBeenCalledWith({ checked: false })
    expect(mockEqFn).toHaveBeenCalledWith('list_id', 'list-k')
    expect(mockEqFn).toHaveBeenCalledWith('checked', true)
  })

  it('bulk rollback: restores the checked flag on snapshotted ids and sets an error on failure', async () => {
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: { message: 'DB error' } })

    await uncheckStore().uncheckAll('list-k')

    const items = useItemsStore.getState().items
    expect(items.find((i) => i.id === 'k-B')?.checked).toBe(true)
    expect(items.find((i) => i.id === 'k-C')?.checked).toBe(true)
    // The originally-unchecked item stays unchecked (not flipped on by rollback).
    expect(items.find((i) => i.id === 'k-A')?.checked).toBe(false)
    expect(useItemsStore.getState().error).toBeTruthy()
  })

  it('no-op when nothing is checked: does not call Supabase update', async () => {
    useItemsStore.setState({
      items: [{ ...uncheckSeed[0] }],
      loading: false, error: null, syncStatus: 'live', channel: null,
    })

    await uncheckStore().uncheckAll('list-k')

    expect(mockUpdateFn).not.toHaveBeenCalled()
  })

  it('does NOT route through pendingReorders: two UPDATE echoes for one id yield one stable result (Pitfall 3)', async () => {
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })

    // Wire the realtime channel so we can fire UPDATE payloads through the reducer.
    useItemsStore.getState().subscribeToList('list-k')
    const onCalls = mockChannelOn.mock.calls
    const payloadCb = onCalls[onCalls.length - 1][2] as (p: Record<string, unknown>) => void

    await uncheckStore().uncheckAll('list-k')

    // Two own-write UPDATE echoes for k-B carrying checked:false — both must merge
    // idempotently (uncheck-all must NOT consume-and-skip via pendingReorders, or the
    // first echo would be dropped and the row could flicker back to checked).
    const echoRow = { ...uncheckSeed[1], checked: false }
    payloadCb({ eventType: 'UPDATE', new: echoRow, old: uncheckSeed[1] })
    payloadCb({ eventType: 'UPDATE', new: echoRow, old: uncheckSeed[1] })

    const after = useItemsStore.getState().items.find((i) => i.id === 'k-B')!
    expect(after.checked).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, QOL-03): toggleChecked fires triggerHaptic on check-ON ONLY (D-12).
// triggerHaptic is mocked at the top of this file. RED until toggleChecked imports
// @/lib/haptics and calls it on the nextChecked === true transition.
// ──────────────────────────────────────────────────────────────────────────
describe('itemsStore — haptic on check (QOL-03)', () => {
  const hapticSeed = {
    id: 'h-1', list_id: 'list-h', name: 'Milk', quantity: null, category: null,
    checked: false, added_by: null, user_id: null,
    created_at: '2026-01-01T00:00:00Z', note: null, position: 'a1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useItemsStore.setState({
      items: [{ ...hapticSeed }],
      loading: false, error: null, syncStatus: 'live', channel: null,
    })
    mockUpdateFn._resolvePromise = Promise.resolve({ data: null, error: null })
  })

  it('fires triggerHaptic on the check-ON transition (false → true)', async () => {
    await useItemsStore.getState().toggleChecked('h-1')
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire triggerHaptic on the check-OFF transition (true → false)', async () => {
    useItemsStore.setState({
      items: [{ ...hapticSeed, checked: true }],
      loading: false, error: null, syncStatus: 'live', channel: null,
    })

    await useItemsStore.getState().toggleChecked('h-1')
    expect(mockTriggerHaptic).not.toHaveBeenCalled()
  })
})
