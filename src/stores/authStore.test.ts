import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

// vi.hoisted() — mocks available inside vi.mock() factory
// (vi.mock is hoisted to the top of the file by Vitest, before variable declarations)
const {
  mockOnAuthStateChange,
  mockSignInWithOAuth,
  mockSignOut,
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
    },
    realtime: { setAuth: mockSetAuth },
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
