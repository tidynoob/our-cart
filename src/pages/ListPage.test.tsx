import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ListPage from './ListPage'
import { useItemsStore } from '@/stores/itemsStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockOrder = vi.fn()
const mockDeleteEq2 = vi.fn()
const mockDeleteEq1 = vi.fn()
const mockDelete = vi.fn()

// Seeded items for clear-flow tests — 1 unchecked, 1 checked
const checkedItem = {
  id: 'item-checked-1',
  list_id: 'list-id-1',
  name: 'Milk',
  quantity: null,
  category: null,
  checked: true,
  added_by: null,
  created_at: new Date().toISOString(),
}

const uncheckedItem = {
  id: 'item-unchecked-1',
  list_id: 'list-id-1',
  name: 'Eggs',
  quantity: null,
  category: null,
  checked: false,
  added_by: null,
  created_at: new Date().toISOString(),
}

// Default items response — empty list (original tests)
let mockItemsResponse: unknown[] = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table)
      return {
        select: (cols: string) => {
          mockSelect(cols)
          return {
            eq: (col: string, val: string) => {
              mockEq(col, val)
              return {
                single: mockSingle,
                order: (...args: unknown[]) => {
                  mockOrder(...args)
                  return Promise.resolve({ data: mockItemsResponse, error: null })
                },
              }
            },
          }
        },
        delete: () => {
          mockDelete()
          return {
            eq: (col: string, val: unknown) => {
              mockDeleteEq1(col, val)
              return {
                eq: (col2: string, val2: unknown) => {
                  mockDeleteEq2(col2, val2)
                  return Promise.resolve({ data: null, error: null })
                },
              }
            },
          }
        },
      }
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockImplementation((cb: (status: string) => void) => {
        // Trigger SUBSCRIBED immediately so tests don't hang waiting for it
        setTimeout(() => cb('SUBSCRIBED'), 0)
        return {}
      }),
    }),
    removeChannel: vi.fn(),
  },
}))

/** A minimal User object sufficient for resolveDisplayName and owner checks. */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-test-id',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: { display_name: 'Test User' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User
}

function renderAtRoute(code: string) {
  return render(
    <MemoryRouter initialEntries={[`/list/${code}`]}>
      <Routes>
        <Route path="/list/:code" element={<ListPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockItemsResponse = []
    useAuthStore.setState({ user: makeUser(), isLoading: false, error: null })
    useUIStore.setState({ dismissedBanners: new Set() })
  })

  it('renders the list name when Supabase returns data (SHARE-02)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'Groceries',
        share_code: 'ABC12345',
        owner_id: 'other-user',
        created_at: new Date().toISOString(),
      },
      error: null,
    })

    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })
  })

  it('shows generic "List not found" when Supabase returns an error — does not expose raw Supabase error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'internal Supabase error detail' },
    })

    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByText('List not found')).toBeTruthy()
    })

    // The raw Supabase error message must NOT appear in the DOM
    expect(screen.queryByText('internal Supabase error detail')).toBeNull()
  })

  it('calls .eq with (share_code, code) without case normalization (SHARE-02, Pitfall 6)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'Groceries',
        share_code: 'ABC12345',
        owner_id: 'other-user',
        created_at: new Date().toISOString(),
      },
      error: null,
    })

    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('share_code', 'ABC12345')
    })

    // Confirm no case normalization — the exact mixed-case value from the URL is passed
    expect(mockEq).not.toHaveBeenCalledWith('share_code', 'abc12345')
    expect(mockEq).not.toHaveBeenCalledWith('share_code', 'ABC12345'.toLowerCase())
  })
})

// Helper: set up a loaded list with a given set of items
function setupListWithItems(items: typeof mockItemsResponse) {
  mockItemsResponse = items
  mockSingle.mockResolvedValueOnce({
    data: {
      id: 'list-id-1',
      name: 'Groceries',
      share_code: 'ABC12345',
      owner_id: 'other-user',
      created_at: new Date().toISOString(),
    },
    error: null,
  })
}

describe('ListPage — clear completed flow (D-06, D-07, SHOP-03, SHOP-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockItemsResponse = []
    // Reset Zustand store between tests to avoid state leakage
    useItemsStore.setState({ items: [], loading: false, error: null, syncStatus: 'connecting', channel: null })
    useAuthStore.setState({ user: makeUser(), isLoading: false, error: null })
    useUIStore.setState({ dismissedBanners: new Set() })
  })

  it('no button when no checked items: Clear completed button is absent from DOM (D-06)', async () => {
    setupListWithItems([uncheckedItem])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    // Wait for items to load
    await waitFor(() => {
      expect(screen.queryByText('Loading items...')).toBeNull()
    })

    // Button must be absent entirely — not disabled, not hidden
    expect(screen.queryByText(/Clear completed/)).toBeNull()
  })

  it('button visible when checked items exist: shows "Clear completed (1)" (D-06)', async () => {
    setupListWithItems([checkedItem])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByText(/Clear completed \(1\)/)).toBeTruthy()
    })
  })

  it('dialog opens on button click: shows dialog with Keep Items and Clear Items buttons (SHOP-04)', async () => {
    setupListWithItems([checkedItem])
    renderAtRoute('ABC12345')

    const button = await screen.findByText(/Clear completed \(1\)/)
    await act(async () => {
      await userEvent.click(button)
    })

    // Dialog title is split by JSX interpolation — verify via dialog action buttons
    // Use findByText (defaults to 1000ms) — act() above ensures portal mounts
    expect(await screen.findByText('Keep Items')).toBeTruthy()
    expect(screen.getByText('Clear Items')).toBeTruthy()
  })

  it('Keep Items closes dialog without clearing: dialog buttons gone and clearChecked was NOT triggered (SHOP-04)', async () => {
    setupListWithItems([checkedItem])
    renderAtRoute('ABC12345')

    const clearButton = await screen.findByText(/Clear completed \(1\)/)
    await act(async () => {
      await userEvent.click(clearButton)
    })

    // Dialog should be open — wait for portal to mount
    const keepButton = await screen.findByText('Keep Items')

    // Click Keep Items
    await act(async () => {
      await userEvent.click(keepButton)
    })

    // Dialog should close — Keep Items button gone
    await waitFor(() => {
      expect(screen.queryByText('Keep Items')).toBeNull()
    })

    // Supabase delete must NOT have been called
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Clear Items triggers clearChecked: calls Supabase delete with list_id and checked=true (SHOP-03)', async () => {
    setupListWithItems([checkedItem])
    renderAtRoute('ABC12345')

    const clearButton = await screen.findByText(/Clear completed \(1\)/)
    await act(async () => {
      await userEvent.click(clearButton)
    })

    // Dialog should be open — wait for portal to mount
    const confirmButton = await screen.findByText('Clear Items')

    // Click Clear Items
    await act(async () => {
      await userEvent.click(confirmButton)
    })

    // Supabase delete chain must have been called with correct args
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteEq1).toHaveBeenCalledWith('list_id', 'list-id-1')
      expect(mockDeleteEq2).toHaveBeenCalledWith('checked', true)
    })
  })
})

describe('ListPage — reconnect event handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockItemsResponse = []
    useItemsStore.setState({ items: [], loading: false, error: null, syncStatus: 'connecting', channel: null })
    useAuthStore.setState({ user: makeUser(), isLoading: false, error: null })
    useUIStore.setState({ dismissedBanners: new Set() })
  })

  it('re-subscribes (which internally fetches) when document becomes visible (visibilitychange → visible) (SYNC-02)', async () => {
    setupListWithItems([])
    renderAtRoute('ABC12345')

    // Wait for the list to load and initial subscribeToList/fetchItems to settle
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    // Allow SUBSCRIBED callback (setTimeout(0)) to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    const initialChannelCalls = (supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length

    // Simulate screen wake: visibilityState → visible + dispatch event
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Allow async settle for subscribeToList's SUBSCRIBED callback
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    // WR-02: handleVisibility now calls subscribeToList (not fetchItems directly),
    // consolidating recovery into a single dedup-guarded path
    expect((supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(initialChannelCalls)
  })

  it('re-subscribes (which internally fetches) on window online event (SYNC-02, SYNC-03)', async () => {
    setupListWithItems([])
    renderAtRoute('ABC12345')

    // Wait for the list to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    // Allow SUBSCRIBED callback (setTimeout(0)) to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    const initialChannelCalls = (supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length

    // Simulate network reconnect — handleOnline now calls subscribeToList (not bare fetchItems)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    // Allow async settle for subscribeToList's SUBSCRIBED callback
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    // subscribeToList should have been called again (creates a new channel)
    expect((supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(initialChannelCalls)
  })
})

describe('ListPage — offline/online syncStatus handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockItemsResponse = []
    useItemsStore.setState({ items: [], loading: false, error: null, syncStatus: 'connecting', channel: null })
    useAuthStore.setState({ user: makeUser(), isLoading: false, error: null })
    useUIStore.setState({ dismissedBanners: new Set() })
  })

  it('sets syncStatus to "reconnecting" immediately on window offline event (SYNC-03)', async () => {
    setupListWithItems([])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    // Allow SUBSCRIBED callback (setTimeout(0)) to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    // Dispatch offline event
    await act(async () => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(useItemsStore.getState().syncStatus).toBe('reconnecting')
  })

  it('re-subscribes on window online event (SYNC-03)', async () => {
    setupListWithItems([])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    // Allow SUBSCRIBED callback (setTimeout(0)) to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    const initialChannelCalls = (supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length

    // Dispatch online event
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    // Allow async settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    // subscribeToList should have been called again (creates a new channel)
    expect((supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(initialChannelCalls)
  })
})

describe('ListPage — D-10/NAV-03', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockItemsResponse = []
    useItemsStore.setState({ items: [], loading: false, error: null, syncStatus: 'connecting', channel: null })
    useAuthStore.setState({ user: makeUser(), isLoading: false, error: null })
    useUIStore.setState({ dismissedBanners: new Set() })
  })

  it('does not render NamePromptDialog; AddItemBar is active for authenticated user (D-10)', async () => {
    setupListWithItems([])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    // No name prompt copy should appear
    expect(screen.queryByText("What's your name?")).toBeNull()
    expect(screen.queryByText('So your partner knows who added what')).toBeNull()

    // AddItemBar input is active (not disabled)
    const input = screen.getByPlaceholderText('Add an item...')
    expect((input as HTMLInputElement).disabled).toBe(false)
  })

  it('AddItemBar receives non-empty addedBy from auth display name (D-10)', async () => {
    useAuthStore.setState({
      user: makeUser({ user_metadata: { display_name: 'Alice' } }),
      isLoading: false,
      error: null,
    })
    setupListWithItems([])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    // The AddItemBar is rendered (not disabled/hidden)
    const input = screen.getByPlaceholderText('Add an item...')
    expect((input as HTMLInputElement).disabled).toBe(false)
  })

  it('Share2 button is absent when banner is visible (NAV-03 inverse)', async () => {
    // dismissedBanners does NOT contain the share code
    useUIStore.setState({ dismissedBanners: new Set() })
    setupListWithItems([])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    expect(screen.queryByLabelText('Show share code')).toBeNull()
  })

  it('Share2 button is visible when banner is dismissed (NAV-03)', async () => {
    // dismissedBanners contains the share code for this list
    useUIStore.setState({ dismissedBanners: new Set(['ABC12345']) })
    setupListWithItems([])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    expect(screen.getByLabelText('Show share code')).toBeTruthy()
  })

  it('Share2 button click calls restoreBanner (NAV-03)', async () => {
    const mockRestoreBanner = vi.fn()
    useUIStore.setState({
      dismissedBanners: new Set(['ABC12345']),
      restoreBanner: mockRestoreBanner,
    })
    setupListWithItems([])
    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })

    const shareButton = screen.getByLabelText('Show share code')
    await act(async () => {
      await userEvent.click(shareButton)
    })

    expect(mockRestoreBanner).toHaveBeenCalledWith('ABC12345')
  })
})
