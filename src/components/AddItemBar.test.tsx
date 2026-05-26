import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddItemBar } from './AddItemBar'

// Module-level mock data and mock functions
let mockSuggestionData: Array<{ name: string; category: string | null; quantity: string | null }> = []
const mockAddItem = vi.fn()

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

// Mock itemsStore — useItemsStore selector pattern
vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: (selector: (state: { addItem: typeof mockAddItem }) => unknown) =>
    selector({ addItem: mockAddItem }),
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
  }
})

describe('AddItemBar autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuggestionData = []
  })

  it.todo('shows suggestions after typing a prefix (LIST-05)')

  it.todo('populates name, category, quantity fields on suggestion selection (LIST-05)')

  it.todo('does NOT auto-submit on suggestion selection (D-04, LIST-05)')

  it.todo('Escape key dismisses the dropdown (LIST-05)')

  it.todo('shows no suggestions when input is empty (LIST-05)')
})

describe('AddItemBar tap targets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuggestionData = []
  })

  it.todo('AddItemBar Category Select trigger has h-11 class (UX-02)')
})
