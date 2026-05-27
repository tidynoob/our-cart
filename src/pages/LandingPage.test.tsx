import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from './LandingPage'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    realtime: { setAuth: vi.fn() },
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}))

describe('LandingPage — auth-conditional rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    })
  })

  it('renders a button with text "Sign in with Google" when user: null and isLoading: false (AUTH-01)', () => {
    useAuthStore.setState({ user: null, isLoading: false })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Sign in with Google')).toBeDefined()
  })

  it('renders "Create a list" heading when user is populated and isLoading: false (AUTH-01)', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com' } as never,
      session: { access_token: 'tok' } as never,
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Create a list')).toBeDefined()
  })

  it('renders loading spinner (animate-spin element) when isLoading: true (AUTH-01)', () => {
    useAuthStore.setState({ isLoading: true, user: null })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })
})
