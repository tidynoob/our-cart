import { describe, it, expect } from 'vitest'
// RED (Wave 0): '@/lib/ordering' does not exist yet — these imports fail until Wave 1.
import { computeReorderKey, parseQuantity, safeReorderKey, stepQuantityText } from '@/lib/ordering'
import type { Item } from '@/types/item'

/**
 * Helper to create a minimal Item for testing.
 * Mirrors categories.test.ts:9-23. `note`/`position` are forward-compatible
 * with the Wave 1 Item-type extension (literal keys land before the type does).
 */
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

describe('parseQuantity (ITEM-03)', () => {
  it('blank string -> 1', () => {
    expect(parseQuantity('')).toBe(1)
  })

  it('whitespace-only string -> 1', () => {
    expect(parseQuantity('   ')).toBe(1)
  })

  it('null -> 1', () => {
    expect(parseQuantity(null)).toBe(1)
  })

  it("'0' -> 1 (clamp floor at 1)", () => {
    expect(parseQuantity('0')).toBe(1)
  })

  it("negative '-3' -> 1 (clamp floor at 1)", () => {
    expect(parseQuantity('-3')).toBe(1)
  })

  it("'abc' (non-numeric) -> 1", () => {
    expect(parseQuantity('abc')).toBe(1)
  })

  it("'3' -> 3", () => {
    expect(parseQuantity('3')).toBe(3)
  })

  it("'2 lbs' -> 2 (leading integer of free text)", () => {
    expect(parseQuantity('2 lbs')).toBe(2)
  })

  it("'  5 ' -> 5 (trims surrounding whitespace)", () => {
    expect(parseQuantity('  5 ')).toBe(5)
  })
})

describe('stepQuantityText (WR-02 — preserves free-text units)', () => {
  it("'2 lbs' +1 -> '3 lbs' (preserves unit)", () => {
    expect(stepQuantityText('2 lbs', 1)).toBe('3 lbs')
  })

  it("'2 lbs' -1 -> '1 lbs' (preserves unit, clamps floor)", () => {
    expect(stepQuantityText('2 lbs', -1)).toBe('1 lbs')
  })

  it("'500g' -1 -> '499g' (no space before unit)", () => {
    expect(stepQuantityText('500g', -1)).toBe('499g')
  })

  it("'3' +1 -> '4' (pure numeric)", () => {
    expect(stepQuantityText('3', 1)).toBe('4')
  })

  it("'1' -1 -> '1' (clamps floor at 1)", () => {
    expect(stepQuantityText('1', -1)).toBe('1')
  })

  it("null +1 -> '2' (blank parses to 1, steps to 2)", () => {
    expect(stepQuantityText(null, 1)).toBe('2')
  })

  it("'a dozen' +1 -> '2 a dozen' (no leading int: keep text as unit)", () => {
    expect(stepQuantityText('a dozen', 1)).toBe('2 a dozen')
  })
})

describe('safeReorderKey (CR-02 / WR-05 — never throws on degenerate neighbors)', () => {
  it('equal neighbors (before === after) does not throw and returns a key after before', () => {
    const key = safeReorderKey('a0004', 'a0004')
    expect(key).not.toBeNull()
    expect(typeof key).toBe('string')
    // Falls back to appending after `before` (after treated as null).
    expect(key! > 'a0004').toBe(true)
  })

  it('unsorted neighbors (before > after) does not throw, appends after before', () => {
    const key = safeReorderKey('a3', 'a1')
    expect(key).not.toBeNull()
    expect(key! > 'a3').toBe(true)
  })

  it('normal ordered neighbors returns a key strictly between', () => {
    const key = safeReorderKey('a1', 'a3')
    expect(key).not.toBeNull()
    expect('a1' < key!).toBe(true)
    expect(key! < 'a3').toBe(true)
  })

  it('invalid-order neighbor against backfill key does not throw', () => {
    // generateKeyBetween('a','a0') throws "invalid order key: a" (WR-05 boundary).
    // safeReorderKey must absorb this and still produce a usable key.
    const key = safeReorderKey('a', 'a0')
    expect(key).not.toBeNull()
    expect(typeof key).toBe('string')
  })

  it('null/null returns a non-empty first key', () => {
    const key = safeReorderKey(null, null)
    expect(key).not.toBeNull()
    expect(key!.length).toBeGreaterThan(0)
  })
})

describe('computeReorderKey (ITEM-02)', () => {
  it('middle slot: before="a1", after="a3" returns a key strictly between (lexicographic)', () => {
    const key = computeReorderKey('a1', 'a3')
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
    // String comparison, NOT numeric.
    expect('a1' < key).toBe(true)
    expect(key < 'a3').toBe(true)
  })

  it('start slot: before=null, after="a1" returns a key sorting BEFORE "a1"', () => {
    const key = computeReorderKey(null, 'a1')
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
    expect(key < 'a1').toBe(true)
  })

  it('end slot: before="a3", after=null returns a key sorting AFTER "a3"', () => {
    const key = computeReorderKey('a3', null)
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
    expect(key > 'a3').toBe(true)
  })

  it('empty target category: before=null, after=null returns a non-empty key', () => {
    const key = computeReorderKey(null, null)
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('appended key after a backfill key sorts after it (A3 interleave boundary)', () => {
    // Padded backfill keys look like 'a0003'; an appended key must sort AFTER.
    const appended = computeReorderKey('a0003', null)
    expect(appended > 'a0003').toBe(true)
    // And a key between the backfilled neighbor and the appended one stays ordered.
    const between = computeReorderKey('a0003', appended)
    expect('a0003' < between).toBe(true)
    expect(between < appended).toBe(true)
    // makeItem keeps the factory referenced (forward-compat note/position fields).
    expect(makeItem({ position: 'a0003' }).position).toBe('a0003')
  })
})
