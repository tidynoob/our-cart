import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
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
  },
}))

function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/list/:code" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/" element={<div>Home (Login)</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: true,
      error: null,
    })
  })

  it('renders a loading spinner (animate-spin element) when isLoading: true (AUTH-03)', () => {
    useAuthStore.setState({ isLoading: true, user: null })

    renderAtRoute('/list/TEST')

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })

  it('redirects to "/" when isLoading: false and user: null (AUTH-03)', () => {
    useAuthStore.setState({ isLoading: false, user: null })

    renderAtRoute('/list/TEST')

    expect(screen.getByText('Home (Login)')).toBeDefined()
  })

  it('stores location.pathname in sessionStorage("returnTo") before redirecting (AUTH-03)', () => {
    useAuthStore.setState({ isLoading: false, user: null })

    renderAtRoute('/list/TEST')

    expect(sessionStorage.getItem('returnTo')).toBe('/list/TEST')
  })

  it('renders Outlet content when isLoading: false and user is populated (AUTH-03)', () => {
    useAuthStore.setState({
      isLoading: false,
      user: { id: 'user-1', email: 'test@example.com' } as never,
      session: { access_token: 'tok' } as never,
    })

    renderAtRoute('/list/TEST')

    expect(screen.getByText('Protected Content')).toBeDefined()
  })
})
