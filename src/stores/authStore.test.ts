import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

// vi.hoisted() — mocks available inside vi.mock() factory
// (vi.mock is hoisted to the top of the file by Vitest, before variable declarations)
const {
  mockOnAuthStateChange,
  mockSignInWithOAuth,
  mockSignOut,
  mockUpdateUser,
  mockGetUser,
  mockSetAuth,
  captureCallback,
  resetCapturedCb,
  getMockUnsubscribe,
} = vi.hoisted(() => {
  let _capturedCb: ((event: string, session: unknown) => void) | null = null
  const _mockUnsubscribe = vi.fn()
  return {
    mockOnAuthStateChange: vi.fn().mockImplementation((cb: (event: string, session: unknown) => void) => {
      _capturedCb = cb
      return { data: { subscription: { unsubscribe: _mockUnsubscribe } } }
    }),
    mockSignInWithOAuth: vi.fn(),
    mockSignOut: vi.fn(),
    mockUpdateUser: vi.fn(),
    mockGetUser: vi.fn(),
    mockSetAuth: vi.fn(),
    captureCallback: () => _capturedCb,
    resetCapturedCb: () => { _capturedCb = null },
    getMockUnsubscribe: () => _mockUnsubscribe,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      updateUser: mockUpdateUser,
      getUser: mockGetUser,
    },
    realtime: { setAuth: mockSetAuth },
    // Fire-and-forget profile upsert in onAuthStateChange — needs from() to not throw
    from: () => ({ upsert: () => Promise.resolve({ data: null, error: null }) }),
  },
}))

describe('authStore — initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCapturedCb()
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: true,
      error: null,
    })
  })

  it('calls supabase.auth.onAuthStateChange exactly once (AUTH-01)', () => {
    useAuthStore.getState().initialize()

    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('sets user and session from the INITIAL_SESSION event callback (AUTH-02)', () => {
    useAuthStore.getState().initialize()

    const cb = captureCallback()
    expect(cb).not.toBeNull()

    const fakeSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      access_token: 'tok-123',
    }
    cb!('INITIAL_SESSION', fakeSession)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(fakeSession.user)
    expect(state.session).toEqual(fakeSession)
  })

  it('sets isLoading: false after the callback fires (AUTH-02)', () => {
    useAuthStore.getState().initialize()

    // Before callback, isLoading should still be true
    expect(useAuthStore.getState().isLoading).toBe(true)

    const cb = captureCallback()
    const fakeSession = {
      user: { id: 'user-1' },
      access_token: 'tok-123',
    }
    cb!('INITIAL_SESSION', fakeSession)

    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('sets isLoading: false when callback receives null session (not signed in) (AUTH-02)', () => {
    useAuthStore.getState().initialize()

    const cb = captureCallback()
    cb!('INITIAL_SESSION', null)

    const state = useAuthStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
  })

  it('calls supabase.realtime.setAuth(token) with the session access_token (AUTH-01)', () => {
    useAuthStore.getState().initialize()

    const cb = captureCallback()
    const fakeSession = {
      user: { id: 'user-1' },
      access_token: 'tok-abc',
    }
    cb!('INITIAL_SESSION', fakeSession)

    expect(mockSetAuth).toHaveBeenCalledWith('tok-abc')
  })

  it('calls supabase.realtime.setAuth(null) when session is null (AUTH-01)', () => {
    useAuthStore.getState().initialize()

    const cb = captureCallback()
    cb!('INITIAL_SESSION', null)

    expect(mockSetAuth).toHaveBeenCalledWith(null)
  })

  it('returns a cleanup function that calls subscription.unsubscribe() (AUTH-01)', () => {
    const cleanup = useAuthStore.getState().initialize()

    expect(typeof cleanup).toBe('function')

    const mockUnsub = getMockUnsubscribe()
    expect(mockUnsub).not.toHaveBeenCalled()

    cleanup()

    expect(mockUnsub).toHaveBeenCalledTimes(1)
  })
})

describe('authStore — signInWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    })
  })

  it('calls supabase.auth.signInWithOAuth with provider: "google" (AUTH-01)', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null })

    await useAuthStore.getState().signInWithGoogle()

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  })

  it('sets error state when signInWithOAuth returns an error (AUTH-01)', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'OAuth provider error' },
    })

    await useAuthStore.getState().signInWithGoogle()

    expect(useAuthStore.getState().error).toBe('OAuth provider error')
  })
})

describe('authStore — updateDisplayName', () => {
  const originalUser = {
    id: 'user-1',
    email: 'alice@example.com',
    user_metadata: { full_name: 'Alice Smith', avatar_url: 'https://example.com/avatar.jpg' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: originalUser as unknown as import('@supabase/supabase-js').User,
      session: null,
      isLoading: false,
      error: null,
    })
  })

  it('trims the name and calls supabase.auth.updateUser with display_name (PROF-01)', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })

    await useAuthStore.getState().updateDisplayName('  Alice  ')

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { display_name: 'Alice' } })
  })

  it('optimistically updates user.user_metadata.display_name before server responds (PROF-01)', async () => {
    let resolveUpdate!: (value: { error: null }) => void
    mockUpdateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve }))

    const promise = useAuthStore.getState().updateDisplayName('Alice')

    // Check optimistic update is in place before server responds
    expect(useAuthStore.getState().user?.user_metadata.display_name).toBe('Alice')

    resolveUpdate({ error: null })
    await promise
  })

  it('does nothing when called with empty string (trim guard)', async () => {
    await useAuthStore.getState().updateDisplayName('')

    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('does nothing when called with whitespace-only string (trim guard)', async () => {
    await useAuthStore.getState().updateDisplayName('   ')

    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('rolls back to server value and sets error on supabase error (PROF-01)', async () => {
    const serverUser = {
      ...originalUser,
      user_metadata: { ...originalUser.user_metadata, display_name: 'Alice Server' },
    }
    mockUpdateUser.mockResolvedValue({ error: { message: 'update failed' } })
    mockGetUser.mockResolvedValue({ data: { user: serverUser } })

    await useAuthStore.getState().updateDisplayName('Alice Bad')

    expect(useAuthStore.getState().user).toEqual(serverUser)
    expect(useAuthStore.getState().error).toBe('update failed')
  })
})
