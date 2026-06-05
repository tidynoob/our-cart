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
 * Step a free-text quantity by a delta while PRESERVING any trailing unit (WR-02).
 *
 * "2 lbs" + 1 -> "3 lbs", "500g" - 1 -> "499g", "2" + 1 -> "3".
 * The leading integer is parsed/clamped via parseQuantity (floor 1) and substituted
 * back in place; anything after the leading integer (units, suffix) is retained.
 * For inputs with no leading integer ("a dozen") parseQuantity yields 1, so we
 * prefix the stepped number and keep the original text as the unit.
 */
export function stepQuantityText(raw: string | null, delta: number): string {
  const text = (raw ?? '').trim()
  const next = Math.max(1, parseQuantity(text) + delta)
  const leading = text.match(/^\s*\d+/)
  if (leading) {
    // Replace ONLY the leading integer, keep the remainder (unit/suffix) intact.
    return text.replace(/^\s*\d+/, String(next))
  }
  // No leading integer: keep the free text as a unit, prefix the stepped count.
  return text ? `${next} ${text}` : String(next)
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
 * Tolerant wrapper around computeReorderKey for reorder/move writes (CR-02, WR-05).
 *
 * generateKeyBetween THROWS when its neighbors are not strictly ordered
 * (before >= after) or are invalid keys against a backfilled neighbor. Those
 * degenerate pairs are reachable in this app: concurrent/rapid adds can mint
 * duplicate position keys (before === after), and mixed legacy/null-position data
 * can pair a key with an invalid-order neighbor. When that happens, rather than
 * throwing — which silently aborts the reorder with no rollback and no error —
 * fall back to appending after `before` (after = null), and if even that throws,
 * return null so the caller can surface an error instead of crashing.
 *
 * Returns the new key, or null if no valid key could be computed.
 */
export function safeReorderKey(
  before: string | null,
  after: string | null
): string | null {
  // Degenerate/duplicate/unsorted neighbor pair → append after `before` instead.
  const safeAfter = before !== null && after !== null && before >= after ? null : after
  try {
    return generateKeyBetween(before, safeAfter)
  } catch {
    // Last resort: the `before` neighbor itself may be an invalid order key
    // (legacy/corrupt data). Append at the very end with no neighbors.
    try {
      return generateKeyBetween(null, null)
    } catch {
      return null
    }
  }
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
