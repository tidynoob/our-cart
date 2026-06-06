import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddItemBar } from './AddItemBar'

// Module-level mock data and mock functions
let mockSuggestionData: Array<{ name: string; category: string | null; quantity: string | null }> = []
const mockAddItem = vi.fn()
// Live store items the AddItemBar reads via useItemsStore(s => s.items) for the
// ITEM-04 duplicate warning. Per-test controllable (name + checked flag).
let mockStoreItems: Array<{ name: string; checked: boolean }> = []

// Mock Supabase with 4-level chain: from -> select -> eq -> order
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({ data: mockSuggestionData, error: null }),
        }),
      }),
    }),
  },
}))

// Mock itemsStore — useItemsStore selector pattern.
// Widened to also expose `items` so Plan 04's `useItemsStore(s => s.items)`
// resolves (without this, `items.some(...)` throws TypeError instead of clean RED).
vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: (
    selector: (state: { addItem: typeof mockAddItem; items: typeof mockStoreItems }) => unknown,
  ) => selector({ addItem: mockAddItem, items: mockStoreItems }),
}))

// Mock @base-ui/react/checkbox (same as ItemRow.test.tsx)
vi.mock('@base-ui/react/checkbox', () => ({
  Checkbox: {
    Root: ({ children, checked, onCheckedChange, ...props }: {
      children: React.ReactNode
      checked?: boolean
      onCheckedChange?: () => void
      [key: string]: unknown
    }) => (
      <span
        role="checkbox"
        aria-checked={checked}
        onClick={onCheckedChange}
        data-checked={checked ? '' : undefined}
        {...props}
      >
        {children}
      </span>
    ),
    Indicator: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  },
}))

// Mock lucide-react Plus icon
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react')
  return {
    ...actual,
    Plus: () => <svg data-testid="plus-icon" />,
    ChevronDownIcon: () => <svg data-testid="chevron-down" />,
    CheckIcon: () => <svg data-testid="check-icon" />,
    ChevronUpIcon: () => <svg data-testid="chevron-up" />,
  }
})

// Mock @base-ui/react/select to render real DOM with className passthrough
vi.mock('@base-ui/react/select', () => ({
  Select: {
    Root: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div data-slot="select-root" {...props}>{children}</div>
    ),
    Trigger: ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: unknown }) => (
      <button data-slot="select-trigger" className={className} {...props}>{children}</button>
    ),
    Value: ({ children, placeholder, className, ...props }: { children?: React.ReactNode; placeholder?: string; className?: string; [key: string]: unknown }) => (
      <span data-slot="select-value" className={className} {...props}>{placeholder}</span>
    ),
    Icon: ({ render }: { render: React.ReactElement }) => render,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Positioner: ({ children }: { children: React.ReactNode; [key: string]: unknown }) => <div>{children}</div>,
    Popup: ({ children }: { children: React.ReactNode; [key: string]: unknown }) => <div>{children}</div>,
    List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Item: ({ children, value }: { children: React.ReactNode; value: string; [key: string]: unknown }) => (
      <div data-slot="select-item" data-value={value}>{children}</div>
    ),
    ItemText: ({ children }: { children: React.ReactNode; [key: string]: unknown }) => <span>{children}</span>,
    ItemIndicator: () => null,
    Separator: () => <hr />,
    ScrollUpArrow: () => null,
    ScrollDownArrow: () => null,
    GroupLabel: () => null,
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}))

describe('AddItemBar autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuggestionData = []
  })

  it('shows suggestions after typing a prefix (LIST-05)', async () => {
    mockSuggestionData = [
      { name: 'Milk', category: 'Dairy', quantity: '2' },
      { name: 'Miso', category: 'Asian', quantity: '1' },
    ]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const input = screen.getByPlaceholderText('Add an item...')
    await user.type(input, 'mi')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeDefined()
    })
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Milk')).toBeDefined()
  })

  it('populates name, category, quantity fields on suggestion selection (LIST-05)', async () => {
    mockSuggestionData = [
      { name: 'Milk', category: 'Dairy', quantity: '2' },
    ]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const input = screen.getByPlaceholderText('Add an item...')
    await user.type(input, 'mi')

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeDefined()
    })

    await user.click(screen.getByText('Milk'))

    // Name input should be populated with 'Milk'
    expect((input as HTMLInputElement).value).toBe('Milk')
  })

  it('does NOT auto-submit on suggestion selection (D-04, LIST-05)', async () => {
    mockSuggestionData = [
      { name: 'Milk', category: 'Dairy', quantity: '2' },
    ]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const input = screen.getByPlaceholderText('Add an item...')
    await user.type(input, 'mi')

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeDefined()
    })

    await user.click(screen.getByText('Milk'))

    // D-04: addItem must NOT be called on selection
    expect(mockAddItem).not.toHaveBeenCalled()
  })

  it('Escape key dismisses the dropdown (LIST-05)', async () => {
    mockSuggestionData = [
      { name: 'Milk', category: 'Dairy', quantity: '2' },
    ]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const input = screen.getByPlaceholderText('Add an item...')
    await user.type(input, 'mi')

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeDefined()
    })

    await user.keyboard('{Escape}')

    // Dropdown should be dismissed
    expect(screen.queryByRole('listbox')).toBeNull()
    // Input should still have typed text
    expect((input as HTMLInputElement).value).toBe('mi')
  })

  it('shows no suggestions when input is empty (LIST-05)', async () => {
    mockSuggestionData = [
      { name: 'Milk', category: 'Dairy', quantity: '2' },
    ]
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    // Wait for the Supabase mock to resolve (component mount fetch)
    await waitFor(() => {
      // Just wait a tick for the useEffect to run
      expect(true).toBe(true)
    })

    // No typing done — input is empty
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('AddItemBar auto-expand on suggestion selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuggestionData = []
  })

  it('expands More Details panel when suggestion has category (UAT gap)', async () => {
    mockSuggestionData = [
      { name: 'Milk', category: 'Dairy', quantity: '2' },
    ]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const input = screen.getByPlaceholderText('Add an item...')
    await user.type(input, 'mi')

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeDefined()
    })

    await user.click(screen.getByText('Milk'))

    // Panel should have expanded — "Less details" text proves it
    expect(screen.getByText('Less details')).toBeDefined()
    // Name should be populated
    expect((input as HTMLInputElement).value).toBe('Milk')
    // Quantity should NOT be pre-filled
    expect(screen.queryByDisplayValue('2')).toBeNull()
  })

  it('keeps panel collapsed when suggestion has no category or quantity', async () => {
    mockSuggestionData = [
      { name: 'Bread', category: null, quantity: null },
    ]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const input = screen.getByPlaceholderText('Add an item...')
    await user.type(input, 'br')

    await waitFor(() => {
      expect(screen.getByText('Bread')).toBeDefined()
    })

    await user.click(screen.getByText('Bread'))

    // Panel should stay collapsed — "More details" still visible
    expect(screen.getByText('More details')).toBeDefined()
    // No quantity input visible
    expect(screen.queryByDisplayValue('')).toBeNull()
  })
})

describe('AddItemBar D-10 — always active for authenticated users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuggestionData = []
  })

  it('AddItemBar is never disabled for authenticated users (D-10)', async () => {
    render(<AddItemBar listId="list-1" addedBy="Alice" />)

    const submitButton = screen.getByRole('button', { name: 'Add item' })
    expect((submitButton as HTMLButtonElement).disabled).toBe(false)

    const input = screen.getByPlaceholderText('Add an item...')
    expect((input as HTMLInputElement).disabled).toBe(false)
  })
})

describe('AddItemBar tap targets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuggestionData = []
  })

  it('AddItemBar Category Select trigger has h-11 class (UX-02)', async () => {
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    // Click "More details" to expand the category/quantity section
    const moreBtn = screen.getByText('More details')
    await user.click(moreBtn)

    // Find the SelectTrigger by data-slot attribute
    const trigger = document.querySelector('[data-slot="select-trigger"]')
    expect(trigger).not.toBeNull()
    expect(trigger!.className).toContain('h-11')
  })

  it('"More details" toggle has min-h-[44px] tap target class (UX-02)', () => {
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const moreBtn = screen.getByText('More details')
    expect(moreBtn.className).toContain('min-h-[44px]')
    expect(moreBtn.className).toContain('flex')
    expect(moreBtn.className).toContain('items-center')
  })
})

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, ITEM-04): live duplicate warning. The warning UI does not exist
// on AddItemBar yet — these queries fail until it lands (Plan 04). The contract:
// case-insensitive match against UNCHECKED store items, role="status", and the
// Add submit button stays ENABLED (non-blocking, D-15).
// ──────────────────────────────────────────────────────────────────────────
describe('AddItemBar — duplicate warning (ITEM-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuggestionData = []
    mockStoreItems = []
  })

  it('shows a role="status" warning for a case-insensitive unchecked match AND keeps Add enabled', async () => {
    mockStoreItems = [{ name: 'Milk', checked: false }]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    const input = screen.getByPlaceholderText('Add an item...')
    await user.type(input, 'milk') // different case than the stored 'Milk'

    const warning = await screen.findByRole('status')
    expect(warning.textContent).toContain('already on your list')
    expect(warning.textContent).toContain('milk')

    // Non-blocking: the Add submit button stays enabled.
    const submitButton = screen.getByRole('button', { name: 'Add item' }) as HTMLButtonElement
    expect(submitButton.disabled).toBe(false)
  })

  it('shows NO warning when the only match is CHECKED (unchecked-only)', async () => {
    mockStoreItems = [{ name: 'Milk', checked: true }]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    await user.type(screen.getByPlaceholderText('Add an item...'), 'milk')

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows NO warning when the typed name does not match any item', async () => {
    mockStoreItems = [{ name: 'Milk', checked: false }]
    const user = userEvent.setup()
    render(<AddItemBar listId="list-1" addedBy="Test User" />)

    await user.type(screen.getByPlaceholderText('Add an item...'), 'eggs')

    expect(screen.queryByRole('status')).toBeNull()
  })

  // Regression for UAT gap 6: adding a brand-new (non-duplicate) item briefly
  // flashed the amber "...is already on your list" warning before the item was
  // added. Root cause (.planning/debug/additembar-dup-warning-flicker.md): the
  // optimistic insert lands SYNCHRONOUSLY while `name` is still populated, and
  // the input is cleared only AFTER `await addItem`. This test drives the REAL
  // submit flow by making mockAddItem mutate the same `mockStoreItems` array the
  // warning reads — exactly like the production store.
  //
  // Assertion form: ORDERING-INVARIANT (the jsdom single-frame flash is not
  // reliably observable). The fix moves setName('') BEFORE the await, so at the
  // moment addItem is invoked the input is ALREADY ''. We assert the input value
  // is '' from inside the mockAddItem body. On current code the clear is
  // post-await, so the input is still 'eggs' inside addItem → RED. After the fix
  // it is '' → GREEN. We also assert no role=status remains after submit settles.
  it('adding a brand-new item does NOT flash the duplicate warning (optimistic-insert race)', async () => {
    mockStoreItems = []
    const user = userEvent.setup()

    // Capture the input value observed at the instant addItem is invoked.
    let inputValueAtAddItem: string | null = null

    render(<AddItemBar listId="list-1" addedBy="Test User" />)
    const input = screen.getByPlaceholderText('Add an item...') as HTMLInputElement

    // Mimic the production optimistic insert: synchronously push an unchecked row
    // carrying the submitted name (second positional arg) into the live array the
    // warning reads, then resolve. Also record the input value at this moment.
    mockAddItem.mockImplementation(
      (_listId: string, submittedName: string) => {
        inputValueAtAddItem = input.value
        mockStoreItems.push({ name: submittedName, checked: false })
        return Promise.resolve()
      },
    )

    await user.type(input, 'eggs')
    // No warning while typing a brand-new name.
    expect(screen.queryByRole('status')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Add item' }))

    // Ordering invariant: the input must already be cleared when addItem runs, so
    // the synchronous optimistic insert never coincides with a populated `name`.
    expect(inputValueAtAddItem).toBe('')

    // And no warning flashes/remains for the just-submitted brand-new item.
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull()
    })
  })
})
