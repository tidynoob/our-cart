import { describe, it, expect } from 'vitest'
// RED (Wave 0): '@/lib/ordering' does not exist yet — these imports fail until Wave 1.
import { computeReorderKey, parseQuantity } from '@/lib/ordering'
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
