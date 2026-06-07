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
import { byPosition } from '@/lib/ordering'

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
 * - Items within a category are sorted by `position` (lexicographic), with a
 *   `created_at` fallback for null positions (legacy rows) — the single ordering
 *   chokepoint, so CategorySection/ListPage need no sort logic (D-09).
 * - When `checkedToBottom` is true, checked items sink to the BOTTOM OF THEIR
 *   OWN category section (not a global pile); ties within each checked/unchecked
 *   group are broken by `byPosition`. The preference is passed in by the caller
 *   (QOL-02 / D-09) — this lib stays PURE and never imports the prefs store.
 */
export function groupItemsByCategory(
  items: Item[],
  checkedToBottom = false
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

  // Return in predefined order, omitting empty categories.
  // Sort each group by position (lexicographic) with created_at fallback (D-09);
  // when checkedToBottom, sink checked below unchecked WITHIN the section first.
  return CATEGORY_ORDER.filter((cat) => groups.has(cat)).map((cat) => ({
    category: cat,
    items: groups.get(cat)!.sort((a, b) => {
      if (checkedToBottom && a.checked !== b.checked) {
        return a.checked ? 1 : -1
      }
      return byPosition(a, b)
    }),
  }))
}
