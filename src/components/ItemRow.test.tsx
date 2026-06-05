import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemRow } from './ItemRow'
import type { Item } from '@/types/item'
import { useProfilesStore } from '@/stores/profilesStore'

// Must mock @/lib/supabase before profilesStore module loads (Web Worker not in jsdom)
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ upsert: vi.fn() }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    }),
    removeChannel: vi.fn(),
  },
}))

// Mock @base-ui/react/checkbox to avoid JSDOM issues with Base UI
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

// Mock @dnd-kit/sortable — useSortable is a no-op in jsdom (real drag cannot run).
// The package is not installed until Plan 01; this factory returns plain objects so
// no real import is needed (RED component tests still exercise note/stepper/swipe logic).
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
  }),
}))

// Mock @dnd-kit/utilities (CSS.Transform.toString) so ItemRow's transform style compiles.
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

// Mock lucide-react icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react')
  return {
    ...actual,
    Check: () => <svg data-testid="check-icon" />,
    Trash2: () => <svg data-testid="trash-icon" />,
    ChevronDownIcon: () => <svg data-testid="chevron-down" />,
    CheckIcon: () => <svg data-testid="check-icon-select" />,
    ChevronUpIcon: () => <svg data-testid="chevron-up" />,
    Minus: () => <svg data-testid="minus-icon" />,
    Plus: () => <svg data-testid="plus-icon" />,
    GripVertical: () => <svg data-testid="grip-icon" />,
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

const baseItem: Item = {
  id: 'item-1',
  list_id: 'list-1',
  name: 'Milk',
  quantity: '2',
  category: 'Dairy',
  checked: false,
  added_by: 'Alice',
  user_id: null,
  created_at: new Date().toISOString(),
  note: null,
  position: 'a1',
} as Item

const defaultProps = {
  item: baseItem,
  isEditing: false,
  isDeleting: false,
  onTap: vi.fn(),
  onDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onConfirmDelete: vi.fn(),
  onCancelEdit: vi.fn(),
  onSave: vi.fn(),
  onToggle: vi.fn(),
}

/** Seed the profilesStore with test data (reactive selector approach — see context_note in 11-06-PLAN.md) */
function seedProfiles(profiles: Record<string, { display_name: string | null; avatar_url: string | null }>) {
  useProfilesStore.setState({ profiles, channel: null })
}

describe('ItemRow display mode — checked visual state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checked visual state: row has opacity-50 and name has line-through when item.checked=true (SHOP-01)', () => {
    const checkedItem = { ...baseItem, checked: true }
    render(<ItemRow {...defaultProps} item={checkedItem} />)

    // The name span should have line-through
    const nameEl = screen.getByText('Milk')
    expect(nameEl.className).toContain('line-through')

    // The row container should have opacity-50
    // The row div is the parent container — find it by checking its class
    const rowDiv = nameEl.closest('[class*="opacity-50"]')
    expect(rowDiv).not.toBeNull()
  })

  it('unchecked visual state: no line-through and no opacity-50 when item.checked=false (SHOP-02)', () => {
    render(<ItemRow {...defaultProps} item={baseItem} />)

    // Name should not have line-through
    const nameEl = screen.getByText('Milk')
    expect(nameEl.className).not.toContain('line-through')

    // No opacity-50 on any ancestor
    const rowDiv = nameEl.closest('[class*="opacity-50"]')
    expect(rowDiv).toBeNull()
  })

  it('stopPropagation: clicking the checkbox wrapper does NOT call onTap; clicking row body DOES call onTap (SHOP-01, D-01)', () => {
    render(<ItemRow {...defaultProps} />)

    // Find the checkbox element (our mock renders with role="checkbox")
    const checkbox = screen.getByRole('checkbox')

    // Find its wrapping stopPropagation div — it's the parent div of the checkbox
    const checkboxWrapper = checkbox.parentElement!

    // Click the checkbox wrapper — onTap should NOT be called (stopPropagation)
    fireEvent.click(checkboxWrapper)
    expect(defaultProps.onTap).not.toHaveBeenCalled()

    // Click the row body (the name span) — onTap SHOULD be called
    const nameEl = screen.getByText('Milk')
    fireEvent.click(nameEl)
    expect(defaultProps.onTap).toHaveBeenCalledTimes(1)
  })
})

describe('ItemRow tap targets', () => {
  it('edit mode Category Select trigger has h-11 class (UX-02)', () => {
    render(<ItemRow {...defaultProps} isEditing={true} />)

    // Find the SelectTrigger by data-slot attribute
    const trigger = document.querySelector('[data-slot="select-trigger"]')
    expect(trigger).not.toBeNull()
    expect(trigger!.className).toContain('h-11')
  })
})

describe('ItemRow — attribution from profilesStore (PROF-04/PROF-05/D-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset profilesStore to empty before each test
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('profile with avatar: shows avatar and profile display_name (PROF-04)', () => {
    seedProfiles({ 'user-1': { display_name: 'Mitchell', avatar_url: 'https://avatar.url' } })
    const item: Item = { ...baseItem, user_id: 'user-1' }
    render(<ItemRow {...defaultProps} item={item} />)
    // profile.avatar_url present → AttributionBadge with display_name → aria-label "Mitchell added this"
    expect(screen.getByLabelText('Mitchell added this')).toBeTruthy()
  })

  it('profile with display_name only (no avatar): shows profile name initials (PROF-04)', () => {
    seedProfiles({ 'user-2': { display_name: 'Alice', avatar_url: null } })
    const item: Item = { ...baseItem, user_id: 'user-2', added_by: 'Alice Old' }
    render(<ItemRow {...defaultProps} item={item} />)
    // profile.display_name but no avatar → AttributionBadge with display_name
    expect(screen.getByLabelText('Alice added this')).toBeTruthy()
  })

  it('no profile entry: falls back to frozen added_by (D-04 fallback chain)', () => {
    // profiles map is empty — no entry for this user_id
    const item: Item = { ...baseItem, user_id: 'unknown-user', added_by: 'Alice' }
    render(<ItemRow {...defaultProps} item={item} />)
    // No profile → fallback to item.added_by
    expect(screen.getByLabelText('Alice added this')).toBeTruthy()
  })

  it('null user_id: falls back to added_by branch (D-04 case — legacy item)', () => {
    const nullUserItem: Item = { ...baseItem, user_id: null, added_by: 'Alice' }
    render(<ItemRow {...defaultProps} item={nullUserItem} />)
    // user_id is null → profiles[''] lookup finds nothing → added_by branch
    expect(screen.getByLabelText('Alice added this')).toBeTruthy()
  })

  it('no profile and no added_by: shows ? unknown badge', () => {
    const unknownItem: Item = { ...baseItem, user_id: null, added_by: null }
    render(<ItemRow {...defaultProps} item={unknownItem} />)
    // No profile, no added_by → ? div
    expect(screen.getByLabelText('Unknown person added this')).toBeTruthy()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, ITEM-01/03/05): note display/edit, quantity stepper clamp,
// swipe-to-delete reveal. The note/stepper/swipe UI does not exist on ItemRow
// yet — these queries fail until the UI lands (Wave 1/2). useSortable is mocked
// to a no-op above (jsdom cannot run a real drag).
// ──────────────────────────────────────────────────────────────────────────

describe('ItemRow — note display (ITEM-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('renders the note as a plain escaped text node under the name (no dangerouslySetInnerHTML)', () => {
    const item: Item = { ...baseItem, note: 'organic' }
    render(<ItemRow {...defaultProps} item={item} />)

    // Note text is queryable as a text node (JSX auto-escapes; XSS guard).
    const noteEl = screen.getByText('organic')
    expect(noteEl).toBeTruthy()
    // No element in the row uses dangerouslySetInnerHTML for the note.
    expect(noteEl.innerHTML).toBe('organic')
  })

  it('renders NO note line when item.note is null', () => {
    render(<ItemRow {...defaultProps} item={{ ...baseItem, note: null }} />)
    expect(screen.queryByText('organic')).toBeNull()
  })
})

describe('ItemRow — quantity stepper (ITEM-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('decrease control is DISABLED at quantity 1 (clamp floor)', () => {
    render(<ItemRow {...defaultProps} item={{ ...baseItem, quantity: '1' }} />)
    const dec = screen.getByLabelText('Decrease quantity') as HTMLButtonElement
    expect(dec.disabled).toBe(true)
  })

  it('increase from quantity 3 saves quantity "4"', () => {
    render(<ItemRow {...defaultProps} item={{ ...baseItem, quantity: '3' }} />)
    const inc = screen.getByLabelText('Increase quantity')
    fireEvent.click(inc)
    expect(defaultProps.onSave).toHaveBeenCalledWith('item-1', { quantity: '4' })
  })

  it('decrease from quantity 3 saves quantity "2"', () => {
    render(<ItemRow {...defaultProps} item={{ ...baseItem, quantity: '3' }} />)
    const dec = screen.getByLabelText('Decrease quantity')
    fireEvent.click(dec)
    expect(defaultProps.onSave).toHaveBeenCalledWith('item-1', { quantity: '2' })
  })

  it('clicking a stepper button does NOT open edit mode (stopPropagation)', () => {
    render(<ItemRow {...defaultProps} item={{ ...baseItem, quantity: '3' }} />)
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    expect(defaultProps.onTap).not.toHaveBeenCalled()
  })
})

describe('ItemRow — note edit (ITEM-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  it('edit mode shows a Note input with the optional placeholder', () => {
    render(<ItemRow {...defaultProps} isEditing={true} />)
    const noteInput = screen.getByLabelText('Note') as HTMLInputElement
    expect(noteInput).toBeTruthy()
    expect(noteInput.placeholder).toBe('Add a note (optional)')
  })

  it('typing a note and blurring saves the note through onSave', () => {
    render(<ItemRow {...defaultProps} isEditing={true} />)
    const noteInput = screen.getByLabelText('Note')
    fireEvent.change(noteInput, { target: { value: 'the green box' } })
    fireEvent.blur(noteInput)
    // Save path receives the new note (focus-scope save fires on blur out of row).
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ note: 'the green box' }),
    )
  })
})

describe('ItemRow — swipe-to-delete reveal (ITEM-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  // jsdom has no real Pointer Events / layout — exercise the LOGIC via synthetic
  // pointer events with clientX deltas, not real touch physics (see 13-VALIDATION jsdom note).
  it('swipe-left past the 64px threshold reveals a Delete affordance; tapping it deletes', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(row, { clientX: 120, pointerId: 1 }) // -80px > 64px threshold
    fireEvent.pointerUp(row, { clientX: 120, pointerId: 1 })

    const del = screen.getByText('Delete')
    expect(del).toBeTruthy()
    fireEvent.click(del)
    expect(defaultProps.onDelete).toHaveBeenCalled()
  })

  it('a short swipe (<64px) snaps back and reveals no Delete affordance', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(row, { clientX: 180, pointerId: 1 }) // -20px < 64px threshold
    fireEvent.pointerUp(row, { clientX: 180, pointerId: 1 })

    expect(screen.queryByText('Delete')).toBeNull()
  })
})
