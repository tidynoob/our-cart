import { describe, it, expect, vi, beforeEach } from 'vitest'
// Import from module that does not exist yet — will fail RED until Wave 2 creates it
import { useProfilesStore } from '@/stores/profilesStore'

// Capture the postgres_changes payload callback registered via .on()
const { mockChannelOn, mockChannelSubscribe, mockRemoveChannel, getCapturedPayloadCb } =
  vi.hoisted(() => {
    let _capturedPayloadCb: ((payload: Record<string, unknown>) => void) | null = null
    const _mockChannelOn = vi.fn().mockImplementation(
      (_type: string, _filter: unknown, cb: (payload: Record<string, unknown>) => void) => {
        _capturedPayloadCb = cb
        return { subscribe: _mockChannelSubscribe }
      }
    )
    const _mockChannelSubscribe = vi.fn().mockReturnValue({})
    const _mockRemoveChannel = vi.fn()
    return {
      mockChannelOn: _mockChannelOn,
      mockChannelSubscribe: _mockChannelSubscribe,
      mockRemoveChannel: _mockRemoveChannel,
      getCapturedPayloadCb: () => _capturedPayloadCb,
    }
  })

// Chainable supabase mock for from('list_members').select().eq() and from('profiles').select().in()
const mockSelectFn = vi.fn()
const mockEqFn = vi.fn()
const mockInFn = vi.fn()

function createMockFrom(table: string) {
  if (table === 'list_members') {
    return {
      select: () => ({
        eq: (col: string, val: unknown) => {
          mockEqFn(col, val)
          return Promise.resolve({
            data: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
            error: null,
          })
        },
      }),
    }
  }
  if (table === 'profiles') {
    return {
      select: () => ({
        in: (col: string, vals: unknown[]) => {
          mockInFn(col, vals)
          return Promise.resolve({
            data: [
              { id: 'user-a', display_name: 'Alice', avatar_url: null },
              { id: 'user-b', display_name: 'Bob', avatar_url: 'https://example.com/b.jpg' },
            ],
            error: null,
          })
        },
      }),
    }
  }
  return { select: mockSelectFn }
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => createMockFrom(table),
    channel: vi.fn().mockReturnValue({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    }),
    removeChannel: mockRemoveChannel,
  },
}))

describe('profilesStore — initial state (PROF-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('profiles map starts empty', () => {
    const state = useProfilesStore.getState()
    expect(state.profiles).toBeDefined()
    expect(Object.keys(state.profiles)).toHaveLength(0)
  })
})

describe('profilesStore — patch (PROF-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('patch(userId, updates) merges updates into profiles[userId]', () => {
    useProfilesStore.getState().patch('user-a', { display_name: 'Alice Updated', avatar_url: null })

    const profile = useProfilesStore.getState().profiles['user-a']
    expect(profile).toBeDefined()
    expect(profile.display_name).toBe('Alice Updated')
    expect(profile.avatar_url).toBeNull()
  })

  it('patch on existing entry merges without overwriting unrelated keys', () => {
    useProfilesStore.setState({
      profiles: {
        'user-a': { display_name: 'Alice', avatar_url: 'https://old.com/a.jpg' },
      },
      channel: null,
    })

    useProfilesStore.getState().patch('user-a', { display_name: 'Alice Renamed' })

    const profile = useProfilesStore.getState().profiles['user-a']
    expect(profile.display_name).toBe('Alice Renamed')
    // avatar_url should remain unless explicitly patched
    expect(profile.avatar_url).toBe('https://old.com/a.jpg')
  })
})

describe('profilesStore — loadForList (PROF-04, PROF-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('calls supabase.from("list_members") then supabase.from("profiles")', async () => {
    await useProfilesStore.getState().loadForList('list-1')

    // Should have called from for list_members (to get member user_ids)
    // and then from for profiles (to fetch profile data)
    // Verify both tables were accessed via their respective mocks
    expect(mockEqFn).toHaveBeenCalledWith('list_id', 'list-1')
    expect(mockInFn).toHaveBeenCalledWith('id', ['user-a', 'user-b'])
  })

  it('populates profiles map after loading', async () => {
    await useProfilesStore.getState().loadForList('list-1')

    const profiles = useProfilesStore.getState().profiles
    expect(profiles['user-a']).toBeDefined()
    expect(profiles['user-a'].display_name).toBe('Alice')
    expect(profiles['user-b']).toBeDefined()
    expect(profiles['user-b'].display_name).toBe('Bob')
  })
})

describe('profilesStore — realtime callback (PROF-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('on postgres_changes UPDATE event, patch is called with updated.id and { display_name, avatar_url }', async () => {
    await useProfilesStore.getState().loadForList('list-1')

    const payloadCb = getCapturedPayloadCb()
    expect(payloadCb).not.toBeNull()

    // Simulate an UPDATE event from Realtime
    payloadCb!({
      eventType: 'UPDATE',
      new: { id: 'user-a', display_name: 'Alice V2', avatar_url: 'https://new.com/a.jpg' },
      old: { id: 'user-a', display_name: 'Alice', avatar_url: null },
    })

    const profile = useProfilesStore.getState().profiles['user-a']
    expect(profile.display_name).toBe('Alice V2')
    expect(profile.avatar_url).toBe('https://new.com/a.jpg')
  })
})
