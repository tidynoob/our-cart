import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'
import { useSidebarContext } from '@/contexts/SidebarContext'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

// vi.hoisted — mock variables available inside vi.mock() factory (hoisted before imports)
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

// Mock child that uses SidebarContext to expose the hamburger trigger (mirrors ListPage)
function MockListPageWithTrigger() {
  const { onOpenSidebar, triggerRef } = useSidebarContext()
  return (
    <div>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        onClick={onOpenSidebar}
        className="h-8 w-8 shrink-0"
      >
        <Menu className="h-4 w-4" />
      </Button>
      <span>List Content</span>
    </div>
  )
}

function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/list/:code" element={<MockListPageWithTrigger />} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 'u1' } as never, isLoading: false, session: null, error: null })
    useListsStore.setState({
      lists: [],
      loading: false,
      error: null,
      fetchLists: vi.fn(),
      createList: vi.fn(),
      renameList: vi.fn(),
      deleteList: vi.fn(),
    } as never)
  })

  it('renders Menu trigger button (NAV-01b)', () => {
    renderAtRoute('/list/abc123')

    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument()
  })

  it('clicking Menu trigger opens the sidebar drawer (NAV-01b)', async () => {
    renderAtRoute('/list/abc123')

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('calls fetchLists on mount when lists is empty (NAV-01c)', async () => {
    const fetchSpy = vi.fn()
    useListsStore.setState({
      lists: [],
      loading: false,
      error: null,
      fetchLists: fetchSpy,
      createList: vi.fn(),
      renameList: vi.fn(),
      deleteList: vi.fn(),
    } as never)

    renderAtRoute('/list/abc123')

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('u1'))
  })

  it('does NOT call fetchLists when lists is already populated (NAV-01d)', async () => {
    const fetchSpy = vi.fn()
    useListsStore.setState({
      lists: [{ id: 'l1', name: 'G', share_code: 'abc123', owner_id: 'u1', created_at: '' }],
      loading: false,
      error: null,
      fetchLists: fetchSpy,
      createList: vi.fn(),
      renameList: vi.fn(),
      deleteList: vi.fn(),
    } as never)

    renderAtRoute('/list/abc123')

    await new Promise((r) => setTimeout(r, 50))

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
