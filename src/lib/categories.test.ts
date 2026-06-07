import { describe, it, expect } from 'vitest'
import {
  SELECTABLE_CATEGORIES,
  CATEGORY_ORDER,
  groupItemsByCategory,
} from './categories'
import type { Item } from '@/types/item'

/** Helper to create a minimal Item for testing. */
function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(),
    list_id: 'list-1',
    name: 'Test Item',
    quantity: null,
    category: null,
    checked: false,
    added_by: null,
    user_id: null,
    created_at: new Date().toISOString(),
    note: null,
    position: null,
    ...overrides,
  } as Item
}

describe('SELECTABLE_CATEGORIES', () => {
  it('has exactly 8 entries (no Uncategorized)', () => {
    expect(SELECTABLE_CATEGORIES).toHaveLength(8)
    expect(SELECTABLE_CATEGORIES).not.toContain('Uncategorized')
  })
})

describe('CATEGORY_ORDER', () => {
  it('has exactly 9 entries (includes Uncategorized last)', () => {
    expect(CATEGORY_ORDER).toHaveLength(9)
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe('Uncategorized')
  })
})

describe('groupItemsByCategory', () => {
  it('returns categories in CATEGORY_ORDER (Produce first, Uncategorized last)', () => {
    const items = [
      makeItem({ name: 'Chips', category: 'Snacks', created_at: '2026-01-01T00:00:00Z' }),
      makeItem({ name: 'Apples', category: 'Produce', created_at: '2026-01-01T00:01:00Z' }),
      makeItem({ name: 'Milk', category: 'Dairy', created_at: '2026-01-01T00:02:00Z' }),
    ]

    const groups = groupItemsByCategory(items)
    const categoryNames = groups.map((g) => g.category)

    // Produce should come before Dairy, Dairy before Snacks
    expect(categoryNames).toEqual(['Produce', 'Dairy', 'Snacks'])
  })

  it('omits empty categories from result', () => {
    const items = [
      makeItem({ name: 'Apples', category: 'Produce' }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('Produce')
  })

  it('maps items with null category to Uncategorized group', () => {
    const items = [
      makeItem({ name: 'Mystery item', category: null }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('Uncategorized')
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].name).toBe('Mystery item')
  })

  it('maps items with undefined category to Uncategorized group', () => {
    const items = [
      makeItem({ name: 'Unknown item', category: undefined as unknown as string | null }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('Uncategorized')
  })

  it('maps items with unrecognized category to Uncategorized group', () => {
    const items = [
      makeItem({ name: 'Weird item', category: 'Electronics' }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('Uncategorized')
  })

  it('maintains insertion order (by created_at) within a category', () => {
    const items = [
      makeItem({ name: 'Bananas', category: 'Produce', created_at: '2026-01-01T00:00:00Z' }),
      makeItem({ name: 'Apples', category: 'Produce', created_at: '2026-01-01T00:01:00Z' }),
      makeItem({ name: 'Oranges', category: 'Produce', created_at: '2026-01-01T00:02:00Z' }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups[0].items.map((i) => i.name)).toEqual([
      'Bananas',
      'Apples',
      'Oranges',
    ])
  })

  it('returns empty array when given no items', () => {
    const groups = groupItemsByCategory([])
    expect(groups).toEqual([])
  })
})

// RED (Wave 0, ITEM-02): groupItemsByCategory does not sort by `position` yet —
// these assertions fail until the byPosition comparator lands in categories.ts (Wave 1).
describe('groupItemsByCategory — position sort (ITEM-02)', () => {
  it('orders items within a category by lexicographic position ascending', () => {
    // Deliberately out of order: a2, a1, a3 should come back a1, a2, a3.
    const items = [
      makeItem({ name: 'Bananas', category: 'Produce', position: 'a2', created_at: '2026-01-01T00:00:00Z' }),
      makeItem({ name: 'Apples', category: 'Produce', position: 'a1', created_at: '2026-01-01T00:01:00Z' }),
      makeItem({ name: 'Oranges', category: 'Produce', position: 'a3', created_at: '2026-01-01T00:02:00Z' }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups[0].items.map((i) => i.position)).toEqual(['a1', 'a2', 'a3'])
    expect(groups[0].items.map((i) => i.name)).toEqual(['Apples', 'Bananas', 'Oranges'])
  })

  it('uses lexicographic (string) order, not numeric — "a10" sorts before "a2"', () => {
    const items = [
      makeItem({ name: 'Two', category: 'Produce', position: 'a2' }),
      makeItem({ name: 'Ten', category: 'Produce', position: 'a10' }),
    ]

    const groups = groupItemsByCategory(items)
    // Lexicographically 'a10' < 'a2', so Ten comes first.
    expect(groups[0].items.map((i) => i.name)).toEqual(['Ten', 'Two'])
  })

  it('sorts a null-position item AFTER keyed items', () => {
    const items = [
      makeItem({ name: 'Legacy', category: 'Produce', position: null, created_at: '2026-01-01T00:00:00Z' }),
      makeItem({ name: 'Keyed', category: 'Produce', position: 'a1', created_at: '2026-01-01T00:01:00Z' }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups[0].items.map((i) => i.name)).toEqual(['Keyed', 'Legacy'])
  })

  it('falls back to created_at order among multiple null-position items', () => {
    const items = [
      makeItem({ name: 'Later', category: 'Produce', position: null, created_at: '2026-01-01T00:02:00Z' }),
      makeItem({ name: 'Earlier', category: 'Produce', position: null, created_at: '2026-01-01T00:01:00Z' }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups[0].items.map((i) => i.name)).toEqual(['Earlier', 'Later'])
  })
})

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, QOL-02 / D-09): groupItemsByCategory(items, checkedToBottom).
// The second arg does not exist yet — groupItemsByCategory currently sorts purely
// by byPosition and ignores `checked`. These fail until the checkedToBottom
// comparator lands (Wave 1). Contract: checked items sink to the BOTTOM OF THEIR OWN
// category section (NOT a global pile); when false / omitted, order === pure byPosition.
// ──────────────────────────────────────────────────────────────────────────
describe('groupItemsByCategory — checkedToBottom (QOL-02)', () => {
  it('sinks checked items to the bottom WITHIN each category section when true', () => {
    // Produce: B(checked,a1) before A(unchecked,a2) by position; with sink ON,
    // unchecked A must come first, checked B last — within Produce only.
    const items = [
      makeItem({ name: 'B-checked', category: 'Produce', position: 'a1', checked: true }),
      makeItem({ name: 'A-unchecked', category: 'Produce', position: 'a2', checked: false }),
      // Dairy has its own independent section with the same shape.
      makeItem({ name: 'D-checked', category: 'Dairy', position: 'a1', checked: true }),
      makeItem({ name: 'C-unchecked', category: 'Dairy', position: 'a2', checked: false }),
    ]

    const groups = groupItemsByCategory(items, true)
    const produce = groups.find((g) => g.category === 'Produce')!
    const dairy = groups.find((g) => g.category === 'Dairy')!

    // Per-section sink — unchecked above checked inside EACH section, not globally.
    expect(produce.items.map((i) => i.name)).toEqual(['A-unchecked', 'B-checked'])
    expect(dairy.items.map((i) => i.name)).toEqual(['C-unchecked', 'D-checked'])
  })

  it('keeps unchecked items in pure byPosition order WITHIN their checked group', () => {
    // Two unchecked + two checked in one section: each group internally byPosition.
    const items = [
      makeItem({ name: 'u2', category: 'Produce', position: 'a4', checked: false }),
      makeItem({ name: 'u1', category: 'Produce', position: 'a1', checked: false }),
      makeItem({ name: 'c2', category: 'Produce', position: 'a3', checked: true }),
      makeItem({ name: 'c1', category: 'Produce', position: 'a2', checked: true }),
    ]

    const groups = groupItemsByCategory(items, true)
    // unchecked (u1<u2 by position) first, then checked (c1<c2 by position).
    expect(groups[0].items.map((i) => i.name)).toEqual(['u1', 'u2', 'c1', 'c2'])
  })

  it('equals pure byPosition order when checkedToBottom is false', () => {
    const items = [
      makeItem({ name: 'B-checked', category: 'Produce', position: 'a1', checked: true }),
      makeItem({ name: 'A-unchecked', category: 'Produce', position: 'a2', checked: false }),
    ]

    const groups = groupItemsByCategory(items, false)
    // No sink: pure byPosition (a1 before a2) regardless of checked.
    expect(groups[0].items.map((i) => i.name)).toEqual(['B-checked', 'A-unchecked'])
  })

  it('defaults to pure byPosition order when the arg is omitted (backward compatible)', () => {
    const items = [
      makeItem({ name: 'B-checked', category: 'Produce', position: 'a1', checked: true }),
      makeItem({ name: 'A-unchecked', category: 'Produce', position: 'a2', checked: false }),
    ]

    const groups = groupItemsByCategory(items)
    expect(groups[0].items.map((i) => i.name)).toEqual(['B-checked', 'A-unchecked'])
  })
})
