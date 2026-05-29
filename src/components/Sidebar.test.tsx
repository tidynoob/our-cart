import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import { useListsStore } from '@/stores/listsStore'
import { useMatch } from 'react-router-dom'

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

const sampleLists = [
  { id: 'l1', name: 'Groceries', share_code: 'abc123', owner_id: 'u1', created_at: '' },
  { id: 'l2', name: 'Hardware', share_code: 'def456', owner_id: 'u1', created_at: '' },
]

function renderOpenSidebar() {
  return render(
    <MemoryRouter initialEntries={['/list/abc123']}>
      <Sidebar open={true} onOpenChange={vi.fn()} lists={sampleLists} />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useListsStore.setState({ lists: sampleLists, loading: false, error: null } as never)
    ;(useMatch as ReturnType<typeof vi.fn>).mockReturnValue(null)
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
        <Sidebar open={true} onOpenChange={onOpenChange} lists={sampleLists} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Groceries' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
