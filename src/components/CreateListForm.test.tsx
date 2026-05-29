import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateListForm from './CreateListForm'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'

const mockCreateList = vi.fn()
const mockNavigate = vi.fn()

// D-04: CreateListForm delegates list creation (owner_id + share_code) to
// listsStore.createList. It no longer touches the Supabase client directly.
vi.mock('@/stores/listsStore', () => ({
  useListsStore: vi.fn(),
}))

// authStore is the real store (for setState), but it imports the Supabase client
// at module load — stub the client so the realtime Web Worker never initializes in jsdom.
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('CreateListForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Component reads `state.createList` via selector — apply the selector to a fake state.
    ;(useListsStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { createList: typeof mockCreateList }) => unknown) =>
        selector({ createList: mockCreateList }),
    )
    // Real auth store — component reads `state.user` and passes user.id to createList.
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com' } as never,
      session: { access_token: 'tok' } as never,
      isLoading: false,
      error: null,
    })
  })

  it('does NOT call createList when name is empty', () => {
    render(<CreateListForm />)
    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)
    // Validation is synchronous — no async wait needed.
    expect(mockCreateList).not.toHaveBeenCalled()
  })

  it('delegates to createList with the trimmed name and the current user id', async () => {
    mockCreateList.mockResolvedValueOnce('abcd1234')

    render(<CreateListForm />)
    const input = screen.getByLabelText(/list name/i)
    fireEvent.change(input, { target: { value: '  My List  ' } })

    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockCreateList).toHaveBeenCalledWith('My List', 'user-1')
    })
  })

  it('navigates to /list/<share-code> returned by createList after success', async () => {
    mockCreateList.mockResolvedValueOnce('abcd1234')

    render(<CreateListForm />)
    const input = screen.getByLabelText(/list name/i)
    fireEvent.change(input, { target: { value: 'Grocery Run' } })

    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/list/abcd1234')
    })
  })

  it('renders generic "Could not create list" text when createList returns no share code', async () => {
    mockCreateList.mockResolvedValueOnce(null)

    render(<CreateListForm />)
    const input = screen.getByLabelText(/list name/i)
    fireEvent.change(input, { target: { value: 'Test List' } })

    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/could not create list/i)).toBeTruthy()
    })

    // No navigation on failure.
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
