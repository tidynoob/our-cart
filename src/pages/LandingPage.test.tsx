import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from './LandingPage'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'

vi.mock('@/stores/listsStore', () => ({
  useListsStore: vi.fn(),
}))

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

describe('LandingPage — delete dialog (LIST-03)', () => {
  const mockDeleteList = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@example.com' } as never,
      session: { access_token: 'tok' } as never,
      isLoading: false,
      error: null,
    })
    ;(useListsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      lists: [{ id: 'l1', name: 'Test List', share_code: 'abc12345', owner_id: 'u1', created_at: '' }],
      loading: false,
      error: null,
      fetchLists: vi.fn(),
      createList: vi.fn(),
      renameList: vi.fn(),
      deleteList: mockDeleteList,
    })
  })

  it('delete dialog renders with "all its items" copy when Trash2 button clicked (LIST-03)', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete Test List' })
    await user.click(deleteButton)

    expect(screen.getByText(/This removes the list and all its items permanently/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('cancel on delete dialog closes without calling deleteList (LIST-03)', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete Test List' })
    await user.click(deleteButton)

    // Dialog is open — description text visible
    expect(screen.getByText(/This removes the list/)).toBeInTheDocument()

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelButton)

    expect(screen.queryByText(/This removes the list/)).not.toBeInTheDocument()
    expect(mockDeleteList).not.toHaveBeenCalled()
  })
})
