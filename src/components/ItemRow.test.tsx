import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemRow } from './ItemRow'
import type { Item } from '@/types/item'

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
}

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

describe('ItemRow — attribution (PROF-02/D-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('own item: shows live display name and avatar when user_id matches currentUserId (PROF-02/D-04)', () => {
    const ownItem: Item = { ...baseItem, user_id: 'user-1' }
    render(
      <ItemRow
        {...defaultProps}
        item={ownItem}
        currentUserId="user-1"
        currentUserDisplayName="Mitchell"
        currentUserAvatarUrl="https://avatar.url"
      />
    )
    // Own-item path: AttributionBadge gets currentUserDisplayName → aria-label "Mitchell added this"
    expect(screen.getByLabelText('Mitchell added this')).toBeTruthy()
  })

  it('non-own item: shows frozen added_by name when user_id differs from currentUserId (D-06)', () => {
    const otherItem: Item = { ...baseItem, user_id: 'user-2', added_by: 'Alice' }
    render(
      <ItemRow
        {...defaultProps}
        item={otherItem}
        currentUserId="user-1"
      />
    )
    // Non-own path: AttributionBadge gets item.added_by → aria-label "Alice added this"
    expect(screen.getByLabelText('Alice added this')).toBeTruthy()
  })

  it('null user_id: falls back to added_by branch (D-06 case 2)', () => {
    const nullUserItem: Item = { ...baseItem, user_id: null, added_by: 'Alice' }
    render(
      <ItemRow
        {...defaultProps}
        item={nullUserItem}
        currentUserId="user-1"
      />
    )
    // user_id is null → isOwnItem is false → added_by branch
    expect(screen.getByLabelText('Alice added this')).toBeTruthy()
  })
})
