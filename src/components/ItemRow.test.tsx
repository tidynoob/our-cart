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

// ──────────────────────────────────────────────────────────────────────────
// Phase 13 gap-closure (13-05 / ITEM-05): desktop-mouse interaction regression.
//
// jsdom CONSTRAINT (see 13-05-PLAN <objective>): jsdom has NO paint-order /
// opaque-overlay hit-testing and NO real setPointerCapture move routing.
// fireEvent.click dispatches directly on the target element. The real-device
// symptoms (mouse hover dragging the row via pointer capture; the opaque
// foreground physically stealing the Delete click) CANNOT be reproduced as RED
// in jsdom by replaying clicks. These tests are deliberately anchored on
// observable, deterministic proxies for the fix MECHANISM: the press-gate's
// early-return effect on dx, and the structural z-index / pointer-events classes
// that are the literal mechanism closing Defect B. The on-device human re-test
// (13-HUMAN-UAT.md tests 2 & 3, real desktop mouse) remains the FINAL gate.
// ──────────────────────────────────────────────────────────────────────────
describe('ItemRow — desktop-mouse interaction regression (UAT gaps 1+2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  // Test A — a NEGATIVE-delta move with NO active press (no button held) must be
  // ignored by the press-gate. We SEED a non-zero swipeStartX via a down/up cycle
  // (so the press is released, dx still 0), then fire a negative move with
  // buttons:0 — on broken code this translates the row (RED); after the gate it
  // early-returns and dx stays 0 (GREEN).
  it('negative-delta pointermove with NO active press is ignored (press-gate)', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    // 1. Seed swipeStartX.current = 200, mark press; 2. release press (dx still 0).
    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(row, { clientX: 200, pointerId: 1, buttons: 0 })
    // 3. Negative move (delta = 120 - 200 = -80) but NO active press, buttons:0.
    fireEvent.pointerMove(row, { clientX: 120, pointerId: 1, buttons: 0 })

    // GREEN: the gate early-returns → dx stays 0 → transform unset/translateX(0px).
    const transform = (row as HTMLElement).style.transform
    expect(transform === '' || transform === 'translateX(0px)').toBe(true)
    expect(screen.queryByText('Delete')).toBeNull()
  })

  // Test B — a SUB-THRESHOLD offset (revealed=false) snaps back to 0 on
  // pointerleave/pointercancel when no press is active. Locked rule: on
  // cancel/leave with no active press — if revealed is false, snap dx→0; if
  // revealed is true, leave the committed reveal intact. Here the -30px offset
  // never crosses the 64px reveal threshold, so revealed=false → deterministic
  // snap-to-0. Parametrized across pointerLeave and pointerCancel.
  it.each(['pointerLeave', 'pointerCancel'] as const)(
    'sub-threshold offset snaps back to 0 on %s with no active press',
    (endEvent) => {
      render(<ItemRow {...defaultProps} />)
      const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
      expect(row).not.toBeNull()

      fireEvent.pointerDown(row, { clientX: 200, pointerId: 1, buttons: 1 })
      // delta = 170 - 200 = -30, UNDER the 64px reveal threshold → dx≈-30, revealed=false.
      fireEvent.pointerMove(row, { clientX: 170, pointerId: 1, buttons: 1 })

      // pointerleave / pointercancel with no button held → snap a sub-threshold offset back.
      fireEvent[endEvent](row, { clientX: 170, pointerId: 1, buttons: 0 })

      const transform = (row as HTMLElement).style.transform
      expect(transform === '' || transform === 'translateX(0px)').toBe(true)
      expect(screen.queryByText('Delete')).toBeNull()
    },
  )

  // Test C — the checkbox stays operable after a swipe offset exists (regression
  // guard). jsdom dispatches the checkbox click directly, so this is GREEN-ish on
  // current code via the existing stopPropagation wrapper; it exists to catch a
  // REGRESSION if Task 2's pointer-events change accidentally makes the checkbox
  // inert. It is NOT the RED→GREEN signal.
  it('checkbox stays operable after a swipe offset (toggles, does not open edit)', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    // Create a sub-threshold offset (-25px).
    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(row, { clientX: 175, pointerId: 1, buttons: 1 })

    fireEvent.click(screen.getByRole('checkbox'))

    expect(defaultProps.onToggle).toHaveBeenCalledWith('item-1')
    expect(defaultProps.onTap).not.toHaveBeenCalled()
  })

  // Test D — revealed-Delete overlay MECHANISM. The structural classes that close
  // Defect B: the revealed Delete wrapper paints above the translated foreground
  // (z-10) AND the foreground is pointer-events-none while revealed. jsdom cannot
  // reproduce the on-device overlay hit-steal; this asserts the structural
  // z-index/pointer-events mechanism instead. The real gate is 13-HUMAN-UAT.md
  // tests 2 & 3 on a real desktop mouse.
  it('revealed Delete wrapper is z-raised and foreground is pointer-events-none (Defect B mechanism)', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    // Full reveal: -80px past the 64px threshold.
    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(row, { clientX: 120, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(row, { clientX: 120, pointerId: 1, buttons: 0 })

    // 1. RED→GREEN signal: structural classes (asserted FIRST).
    // The revealed Delete WRAPPER carries a raised z-index (z-10+).
    const deleteWrapper = screen.getByText('Delete').closest('[class*="absolute"]') as HTMLElement
    expect(deleteWrapper).not.toBeNull()
    expect(deleteWrapper.className).toContain('z-10')

    // The translated FOREGROUND carries pointer-events-none WHILE revealed.
    expect((row as HTMLElement).className).toContain('pointer-events-none')

    // 2. Non-RED guard (GREEN throughout via jsdom direct dispatch): Delete still
    //    routes to onDelete and never opens edit.
    fireEvent.click(screen.getByText('Delete'))
    expect(defaultProps.onDelete).toHaveBeenCalled()
    expect(defaultProps.onTap).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Phase 13 gap-closure v2 (13-06 / ITEM-03/05): capture-on-tap + swipe-back.
//
// jsdom CONSTRAINT (restated from 13-06-PLAN <objective>): jsdom has NO real
// setPointerCapture move-routing, NO paint-order hit-testing, and NO mouse
// buttons=0 physics. 13-05's tests passed GREEN while the device stayed broken,
// so these tests do NOT "prove" gaps 2/4/7 via replayed jsdom clicks — they
// assert the fix MECHANISM at its call sites: (1) setPointerCapture is NOT
// invoked on a tap-only pointer sequence, (2) handleRowTap no-ops when the
// originating pointerdown target was an interactive child, and (3) a delta>0
// move from a revealed state reduces |dx| and un-reveals. The on-device human
// re-test (13-UAT.md tests 2, 4 & 7, real desktop mouse + touch) is the FINAL
// gate for closing these three gaps.
// ──────────────────────────────────────────────────────────────────────────
describe('ItemRow — capture-on-tap + swipe-back regression (UAT gaps 2/4/7, v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesStore.setState({ profiles: {}, channel: null })
  })

  // Test 1 — a plain TAP does NOT capture the pointer (the core gap 2/4 mechanism).
  // RED-feasibility: current handleSwipePointerDown calls setPointerCapture
  // unconditionally (ItemRow.tsx:121), so on a tap it IS called → not.toHaveBeenCalled()
  // FAILS (RED). After Task 2 capture moves into pointermove behind the slop+delta<0
  // guard → a tap never reaches it → PASS (GREEN).
  // The spy approach asserts the call-site contract (capture invoked only during an
  // actual swipe) — the literal mechanism behind the on-device fix; jsdom Elements
  // lack setPointerCapture unless polyfilled, so we attach a vi.fn() spy before firing.
  it('a plain tap does NOT call setPointerCapture (capture-on-swipe-only mechanism)', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    row.setPointerCapture = vi.fn()
    row.releasePointerCapture = vi.fn()

    // Pure tap: pointerdown then pointerup at the SAME clientX, no move.
    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(row, { clientX: 200, pointerId: 1, buttons: 0 })

    expect(row.setPointerCapture).not.toHaveBeenCalled()
  })

  // Test 2 — a tap whose pointerdown ORIGINATED on the checkbox does NOT open edit
  // (interactive-child origin guard).
  // RED-feasibility: today the only thing suppressing onTap on a checkbox tap is the
  // wrapper's stopPropagation. The NEW contract: ItemRow records the pointerdown
  // origin and handleRowTap no-ops for an interactive-child origin even if a click
  // reaches the foreground. We fire pointerdown on the CHECKBOX (so the origin guard,
  // not stopPropagation, must suppress onTap), then a click on the FOREGROUND (row)
  // simulating the mis-routed activation. On current code the foreground's onClick=
  // handleRowTap fires onTap (no origin guard) → FAILS (RED). After Task 2's origin
  // ref guard → handleRowTap returns early → PASS.
  // This proxies the on-device capture hit-steal jsdom cannot replay; the real gate
  // is UAT test 2.
  it('a tap originating on the checkbox does NOT open edit even if a click reaches the foreground (origin guard)', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    const checkbox = screen.getByRole('checkbox')
    fireEvent.pointerDown(checkbox, { clientX: 200, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(checkbox, { clientX: 200, pointerId: 1, buttons: 0 })
    // Mis-routed activation: a click lands on the foreground (as capture would route it).
    fireEvent.click(row)

    expect(defaultProps.onTap).not.toHaveBeenCalled()
  })

  // Test 3 — a delta>0 drag from a REVEALED state reduces |dx| and un-reveals (gap 7).
  // RED-feasibility: handleSwipePointerMove has NO delta>0 branch (ItemRow.tsx:132)
  // → from dx=-96 a rightward drag leaves dx=-96 and revealed=true → the assertion
  // FAILS (RED). After Task 2 adds the delta>0 reduce-and-clear branch → dx returns
  // to 0 and Delete disappears → PASS.
  it('a delta>0 drag from a revealed state reduces |dx| and clears the reveal (swipe-back)', () => {
    render(<ItemRow {...defaultProps} />)
    const row = screen.getByText('Milk').closest('[data-swipe-row]') as HTMLElement
    expect(row).not.toBeNull()

    // Phase 1 — fully reveal: -100px past the -64 threshold → dx snaps to -96, revealed.
    fireEvent.pointerDown(row, { clientX: 200, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(row, { clientX: 100, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(row, { clientX: 100, pointerId: 1, buttons: 0 })
    expect(screen.getByText('Delete')).toBeTruthy()

    // Phase 2 — swipe back: a new gesture starting at the revealed position, dragged
    // rightward by +120 (start 100 → 220). From the revealed baseline (-96) this moves
    // dx past -64 toward 0 → reveal cleared, dx snaps to 0.
    fireEvent.pointerDown(row, { clientX: 100, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(row, { clientX: 220, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(row, { clientX: 220, pointerId: 1, buttons: 0 })

    // Delete is gone AND the foreground is no longer translated.
    expect(screen.queryByText('Delete')).toBeNull()
    const transform = (row as HTMLElement).style.transform
    expect(transform === '' || transform === 'translateX(0px)').toBe(true)
  })
})
