import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Item } from '@/types/item'
import { UndoSnackbar } from './UndoSnackbar'

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, SHOP-05 / D-02): UndoSnackbar is a transient role="status" live
// region driven by itemsStore (lastCleared / undoClear / clearLastCleared). The
// component does not exist yet — this fails at import until UndoSnackbar.tsx lands
// (Wave 1). UI-SPEC §1: role="status" aria-live="polite", copy `Cleared {n} item{s}.`,
// Undo button aria-label="Undo clear", 5s auto-dismiss.
// ──────────────────────────────────────────────────────────────────────────

// Per-test controllable store slice (mirrors AddItemBar.test.tsx selector mock).
let mockLastCleared: Item[] = []
const mockUndoClear = vi.fn()
const mockClearLastCleared = vi.fn()

vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: (
    selector: (state: {
      lastCleared: Item[]
      undoClear: typeof mockUndoClear
      clearLastCleared: typeof mockClearLastCleared
    }) => unknown,
  ) =>
    selector({
      lastCleared: mockLastCleared,
      undoClear: mockUndoClear,
      clearLastCleared: mockClearLastCleared,
    }),
}))

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(),
    list_id: 'list-1',
    name: 'Test',
    quantity: null,
    category: null,
    checked: true,
    added_by: null,
    user_id: null,
    created_at: new Date().toISOString(),
    note: null,
    position: null,
    ...overrides,
  } as Item
}

describe('UndoSnackbar (SHOP-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLastCleared = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when lastCleared is empty', () => {
    mockLastCleared = []
    const { container } = render(<UndoSnackbar />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a role="status" aria-live="polite" region with pluralized copy when items were cleared', () => {
    mockLastCleared = [makeItem(), makeItem(), makeItem()]
    render(<UndoSnackbar />)

    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toContain('Cleared 3 items.')
  })

  it('uses the singular form for one cleared item', () => {
    mockLastCleared = [makeItem()]
    render(<UndoSnackbar />)

    const region = screen.getByRole('status')
    expect(region.textContent).toContain('Cleared 1 item.')
    expect(region.textContent).not.toContain('1 items')
  })

  it('the Undo button (aria-label="Undo clear") calls undoClear when clicked', async () => {
    mockLastCleared = [makeItem()]
    const user = userEvent.setup()
    render(<UndoSnackbar />)

    const undoButton = screen.getByRole('button', { name: 'Undo clear' })
    await user.click(undoButton)

    expect(mockUndoClear).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses after 5s by calling clearLastCleared (fake timers)', () => {
    vi.useFakeTimers()
    mockLastCleared = [makeItem()]
    render(<UndoSnackbar />)

    expect(mockClearLastCleared).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(mockClearLastCleared).toHaveBeenCalledTimes(1)
  })
})
