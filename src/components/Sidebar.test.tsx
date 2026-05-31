import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import { useListsStore } from '@/stores/listsStore'
import { useMatch } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

// Preserve actual react-router-dom implementations, override only hooks used by Sidebar
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useMatch: vi.fn(),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  }
})

// vi.hoisted — mock variables available inside vi.mock() factory
const { mockFrom } = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })
  const mockEq = vi.fn().mockReturnThis()
  const mockSelect = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
  })
  return { mockFrom }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    realtime: { setAuth: vi.fn() },
  },
}))

const mockUpdateDisplayName = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector?: (state: { error: string | null }) => unknown) => {
    if (selector) {
      return selector({ error: null })
    }
    return {
      updateDisplayName: mockUpdateDisplayName,
      signOut: mockSignOut,
      error: null,
    }
  }),
}))

// Patch useAuthStore.getState to return mocked actions
import { useAuthStore } from '@/stores/authStore'

const sampleLists = [
  { id: 'l1', name: 'Groceries', share_code: 'abc123', owner_id: 'u1', created_at: '' },
  { id: 'l2', name: 'Hardware', share_code: 'def456', owner_id: 'u1', created_at: '' },
]

const mockUser: Partial<User> = {
  id: 'u1',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Alice',
    avatar_url: 'https://google.com/avatar.jpg',
  },
}

function renderOpenSidebar(user: Partial<User> | null = null) {
  return render(
    <MemoryRouter initialEntries={['/list/abc123']}>
      <Sidebar
        open={true}
        onOpenChange={vi.fn()}
        lists={sampleLists}
        user={user as User | null}
      />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useListsStore.setState({ lists: sampleLists, loading: false, error: null } as never)
    ;(useMatch as ReturnType<typeof vi.fn>).mockReturnValue(null)
    // Reset getState mock
    ;(useAuthStore as unknown as ReturnType<typeof vi.fn> & { getState?: () => unknown }).getState = vi.fn().mockReturnValue({
      updateDisplayName: mockUpdateDisplayName,
      signOut: mockSignOut,
      error: null,
    })
  })

  it('renders all list names when open (NAV-01a)', () => {
    renderOpenSidebar()

    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
  })

  it('active list row has aria-current="page" (NAV-02a)', () => {
    ;(useMatch as ReturnType<typeof vi.fn>).mockReturnValue({ params: { code: 'abc123' } })

    renderOpenSidebar()

    const activeLink = screen.getByRole('link', { name: 'Groceries' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('active list row has visual-distinct class bg-sidebar-accent (NAV-02b)', () => {
    ;(useMatch as ReturnType<typeof vi.fn>).mockReturnValue({ params: { code: 'abc123' } })

    renderOpenSidebar()

    const activeLink = screen.getByRole('link', { name: 'Groceries' })
    expect(activeLink.className).toMatch(/bg-sidebar-accent/)
    expect(activeLink.className).toMatch(/font-semibold/)
  })

  it('clicking a list row calls onOpenChange(false) (D-08)', () => {
    const onOpenChange = vi.fn()

    render(
      <MemoryRouter>
        <Sidebar open={true} onOpenChange={onOpenChange} lists={sampleLists} user={null} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Groceries' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('Sidebar — profile section (PROF-01/02/03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useListsStore.setState({ lists: sampleLists, loading: false, error: null } as never)
    ;(useMatch as ReturnType<typeof vi.fn>).mockReturnValue(null)
    ;(useAuthStore as unknown as ReturnType<typeof vi.fn> & { getState?: () => unknown }).getState = vi.fn().mockReturnValue({
      updateDisplayName: mockUpdateDisplayName,
      signOut: mockSignOut,
      error: null,
    })
  })

  it('renders avatar img when user has avatar_url with referrerPolicy="no-referrer" (PROF-02)', () => {
    renderOpenSidebar(mockUser)

    const img = screen.getByRole('img', { name: 'Alice' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://google.com/avatar.jpg')
    expect(img).toHaveAttribute('referrerPolicy', 'no-referrer')
  })

  it('renders initials fallback when user has no avatar_url (PROF-02 fallback)', () => {
    const userNoAvatar: Partial<User> = {
      id: 'u1',
      email: 'test@example.com',
      user_metadata: { full_name: 'Alice' },
    }
    renderOpenSidebar(userNoAvatar)

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders resolved display name from fallback chain (PROF-01)', () => {
    renderOpenSidebar(mockUser)

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('pencil button opens edit mode with input and Save/Cancel buttons (PROF-01)', () => {
    renderOpenSidebar(mockUser)

    const pencilBtn = screen.getByRole('button', { name: 'Edit display name' })
    fireEvent.click(pencilBtn)

    expect(screen.getByRole('textbox', { name: 'Display name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('Save button calls authStore.updateDisplayName with the trimmed name (PROF-01)', async () => {
    mockUpdateDisplayName.mockResolvedValue(undefined)
    renderOpenSidebar(mockUser)

    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }))

    const input = screen.getByRole('textbox', { name: 'Display name' })
    fireEvent.change(input, { target: { value: '  Bob  ' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))

    await waitFor(() => {
      expect(mockUpdateDisplayName).toHaveBeenCalledWith('  Bob  ')
    })
  })

  it('Cancel button closes edit mode without saving (PROF-01)', () => {
    renderOpenSidebar(mockUser)

    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }))
    expect(screen.getByRole('textbox', { name: 'Display name' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('textbox', { name: 'Display name' })).toBeNull()
    expect(mockUpdateDisplayName).not.toHaveBeenCalled()
  })

  it('Save button is disabled when input value is empty (PROF-01 — V5 Input Validation)', () => {
    renderOpenSidebar(mockUser)

    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }))

    const input = screen.getByRole('textbox', { name: 'Display name' })
    fireEvent.change(input, { target: { value: '' } })

    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled()
  })

  it('sign-out button calls onOpenChange(false) AND authStore.signOut() (PROF-03)', async () => {
    const onOpenChange = vi.fn()
    mockSignOut.mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/list/abc123']}>
        <Sidebar
          open={true}
          onOpenChange={onOpenChange}
          lists={sampleLists}
          user={mockUser as User}
        />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
  })
})
