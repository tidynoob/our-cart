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

// Mock lucide-react Check icon
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react')
  return {
    ...actual,
    Check: () => <svg data-testid="check-icon" />,
  }
})

const baseItem: Item = {
  id: 'item-1',
  list_id: 'list-1',
  name: 'Milk',
  quantity: '2',
  category: 'Dairy',
  checked: false,
  added_by: 'Alice',
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
