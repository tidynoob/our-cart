/**
 * Pure ordering + quantity helpers for grocery items.
 *
 * parseQuantity: parses the leading integer of a free-text quantity, clamped to >= 1.
 * computeReorderKey: wraps fractional-indexing's generateKeyBetween for stable
 *   lexicographic reorder keys. Callers MUST pass (before, after) already sorted
 *   with null at boundaries — never reversed/equal (generateKeyBetween requires a < b).
 * byPosition: comparator sorting items by lexicographic `position`, with null
 *   positions (legacy rows) sorting AFTER keyed rows, then by `created_at`.
 *
 * Per D-03, D-06 (position TEXT via fractional-indexing).
 */
import { generateKeyBetween } from 'fractional-indexing'
import type { Item } from '@/types/item'

/**
 * Parse a free-text quantity into a positive integer.
 * Takes the leading integer ("2 lbs" -> 2); blank/null/non-numeric/<1 -> 1.
 */
export function parseQuantity(raw: string | null): number {
  const n = parseInt((raw ?? '').trim(), 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/**
 * Compute a fractional-index key strictly between two neighbors.
 * Pass `null` for `before` to insert at the start, `null` for `after` to append.
 * Callers MUST pass sorted (before < after) — generateKeyBetween throws on a >= b.
 */
export function computeReorderKey(
  before: string | null,
  after: string | null
): string {
  return generateKeyBetween(before, after)
}

/**
 * Comparator: sort by lexicographic `position` ascending.
 * Null positions (legacy rows) sort AFTER keyed rows, then by `created_at`.
 */
export function byPosition(a: Item, b: Item): number {
  if (a.position != null && b.position != null) {
    return a.position < b.position ? -1 : a.position > b.position ? 1 : 0
  }
  if (a.position != null) return -1
  if (b.position != null) return 1
  return a.created_at.localeCompare(b.created_at)
}
