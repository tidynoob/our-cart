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
    ...overrides,
  }
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
