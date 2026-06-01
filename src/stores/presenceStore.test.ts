import { describe, it, expect, vi, beforeEach } from 'vitest'
// Import from a module that does NOT exist yet — this WILL fail RED at module
// resolution until Wave 1 (plan 12-02) creates src/stores/presenceStore.ts.
// That import failure IS the intended Wave 0 state.
import { usePresenceStore } from '@/stores/presenceStore'

// Hoisted channel mock combining the two existing realtime-test harnesses:
//   - itemsStore.test.ts: captures the .subscribe(status => …) callback.
//   - profilesStore.test.ts: captures the .on(event, …) callback + channel-mock factory.
// Presence additionally needs per-event callbacks keyed by filter.event
// (sync / join / leave), a stubbable presenceState(), and track()/untrack() spies.
const {
  mockChannel,
  mockTrack,
  mockUntrack,
  mockRemoveChannel,
  getEventCb,
  getSubscribeCb,
  setPresenceState,
} = vi.hoisted(() => {
  const _eventCbs: Record<string, (arg?: unknown) => void> = {}
  let _subscribeCb: ((status: string) => void) | null = null
  let _state: Record<string, unknown[]> = {}

  const _mockChannelOn = vi.fn().mockImplementation(
    (_type: string, filter: { event: string }, cb: (arg?: unknown) => void) => {
      _eventCbs[filter.event] = cb
      return _channelObj // chainable
    }
  )
  const _mockChannelSubscribe = vi.fn().mockImplementation((cb: (status: string) => void) => {
    _subscribeCb = cb
    return _channelObj
  })
  const _mockTrack = vi.fn().mockResolvedValue('ok')
  const _mockUntrack = vi.fn().mockResolvedValue('ok')
  const _mockPresenceState = vi.fn().mockImplementation(() => _state)
  const _mockRemoveChannel = vi.fn()

  const _channelObj = {
    on: _mockChannelOn,
    subscribe: _mockChannelSubscribe,
    track: _mockTrack,
    untrack: _mockUntrack,
    presenceState: _mockPresenceState,
  }
  const _mockChannel = vi.fn().mockReturnValue(_channelObj)

  return {
    mockChannel: _mockChannel,
    mockTrack: _mockTrack,
    mockUntrack: _mockUntrack,
    mockRemoveChannel: _mockRemoveChannel,
    getEventCb: (e: string) => _eventCbs[e],
    getSubscribeCb: () => _subscribeCb,
    setPresenceState: (s: Record<string, unknown[]>) => {
      _state = s
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const selfId = 'user-self'
const otherId = 'user-other'
const identity = { display_name: 'Bob', avatar_url: null }

describe('presenceStore — subscribe (channel + key + track-on-SUBSCRIBED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPresenceState({})
    usePresenceStore.setState({ others: [], channel: null })
  })

  it('opens the channel with config.presence.key === userId (dedupe by user.id)', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    expect(mockChannel).toHaveBeenCalled()
    const [topic, opts] = mockChannel.mock.calls[0]
    expect(topic).toBe('presence-list-1')
    expect(opts).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          presence: expect.objectContaining({ key: selfId }),
        }),
      })
    )
  })

  it('does NOT call track() until the subscribe callback fires SUBSCRIBED', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    // The subscribe-status callback was captured but not yet driven.
    expect(getSubscribeCb()).not.toBeNull()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('calls track() once with { user_id } only after SUBSCRIBED', async () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    await getSubscribeCb()!('SUBSCRIBED')

    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: selfId })
    )
  })

  it('does NOT track on a non-SUBSCRIBED status', async () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    await getSubscribeCb()!('CHANNEL_ERROR')

    expect(mockTrack).not.toHaveBeenCalled()
  })
})

describe('presenceStore — sync derives "others" (self filter + dedupe)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPresenceState({})
    usePresenceStore.setState({ others: [], channel: null })
  })

  it('filters out self: two distinct keys yield exactly one "other"', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    setPresenceState({ [selfId]: [{}], [otherId]: [{}] })
    getEventCb('sync')!()

    const others = usePresenceStore.getState().others
    expect(others).toHaveLength(1)
    expect(others[0].user_id).toBe(otherId)
  })

  it('two-tab dedupe: one key with a 2-element array yields exactly one "other"', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    // Same partner in two tabs => one key, two presence_refs under it.
    setPresenceState({ [otherId]: [{ presence_ref: 'a' }, { presence_ref: 'b' }] })
    getEventCb('sync')!()

    const others = usePresenceStore.getState().others
    expect(others).toHaveLength(1)
    expect(others[0].user_id).toBe(otherId)
  })

  it('self-only presence yields zero others', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    setPresenceState({ [selfId]: [{ presence_ref: 'a' }, { presence_ref: 'b' }] })
    getEventCb('sync')!()

    expect(usePresenceStore.getState().others).toHaveLength(0)
  })
})

describe('presenceStore — leave drops the badge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPresenceState({})
    usePresenceStore.setState({ others: [], channel: null })
  })

  it('after a sync with other present, removing the key + firing leave empties others', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    setPresenceState({ [selfId]: [{}], [otherId]: [{}] })
    getEventCb('sync')!()
    expect(usePresenceStore.getState().others).toHaveLength(1)

    // Partner leaves: their key disappears from presenceState, leave fires.
    setPresenceState({ [selfId]: [{}] })
    getEventCb('leave')!()

    expect(usePresenceStore.getState().others).toHaveLength(0)
  })
})

describe('presenceStore — StrictMode re-subscribe guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPresenceState({})
    usePresenceStore.setState({ others: [], channel: null })
  })

  it('removes the prior channel before opening a second one (ghost-channel guard)', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)
    expect(mockChannel).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).not.toHaveBeenCalled()

    // Second subscribe (React 19 StrictMode double-mount) must remove first.
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(mockChannel).toHaveBeenCalledTimes(2)
    // removeChannel must precede the second channel() call.
    const removeOrder = mockRemoveChannel.mock.invocationCallOrder[0]
    const secondChannelOrder = mockChannel.mock.invocationCallOrder[1]
    expect(removeOrder).toBeLessThan(secondChannelOrder)
  })
})

describe('presenceStore — unsubscribe cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPresenceState({})
    usePresenceStore.setState({ others: [], channel: null })
  })

  it('calls untrack() then removeChannel() and clears state', () => {
    usePresenceStore.getState().subscribe('list-1', selfId, identity)

    usePresenceStore.getState().unsubscribe()

    expect(mockUntrack).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(usePresenceStore.getState().channel).toBeNull()
    expect(usePresenceStore.getState().others).toHaveLength(0)
  })
})
