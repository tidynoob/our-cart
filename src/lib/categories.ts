/**
 * Category constants and grouping utility for grocery items.
 *
 * SELECTABLE_CATEGORIES: The 8 categories shown in dropdown UIs.
 * CATEGORY_ORDER: All 9 display groups including Uncategorized (for grouping only).
 * groupItemsByCategory: Groups a flat items array into ordered category sections.
 *
 * Per D-04, D-05, D-06: Uncategorized is a grouping-only label, not selectable.
 */
import type { Item } from '@/types/item'

/** Categories available for selection in add/edit dropdowns. */
export const SELECTABLE_CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat',
  'Bakery',
  'Frozen',
  'Beverages',
  'Snacks',
  'Other',
] as const

/** Full display order including the Uncategorized grouping label at the end. */
export const CATEGORY_ORDER = [
  'Produce',
  'Dairy',
  'Meat',
  'Bakery',
  'Frozen',
  'Beverages',
  'Snacks',
  'Other',
  'Uncategorized',
] as const

/** A value that can be selected in dropdowns. */
export type CategoryValue = (typeof SELECTABLE_CATEGORIES)[number]

/** A value used for display grouping (includes Uncategorized). */
export type CategoryGroup = (typeof CATEGORY_ORDER)[number]

/**
 * Groups items by category in CATEGORY_ORDER.
 * - Items with null, undefined, or unrecognized category go to Uncategorized.
 * - Empty categories are omitted from the result.
 * - Items within a category maintain their insertion order.
 */
export function groupItemsByCategory(
  items: Item[]
): { category: CategoryGroup; items: Item[] }[] {
  const groups = new Map<CategoryGroup, Item[]>()

  for (const item of items) {
    const isKnownCategory =
      item.category != null &&
      (CATEGORY_ORDER as readonly string[]).includes(item.category) &&
      item.category !== 'Uncategorized'

    const cat: CategoryGroup = isKnownCategory
      ? (item.category as CategoryGroup)
      : 'Uncategorized'

    const existing = groups.get(cat)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(cat, [item])
    }
  }

  // Return in predefined order, omitting empty categories
  return CATEGORY_ORDER.filter((cat) => groups.has(cat)).map((cat) => ({
    category: cat,
    items: groups.get(cat)!,
  }))
}
