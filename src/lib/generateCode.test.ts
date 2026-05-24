import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'

describe('nanoid(8) share code generation', () => {
  it('returns exactly 8 characters', () => {
    const code = nanoid(8)
    expect(code).toHaveLength(8)
  })

  it('returns only characters from the URL-safe alphabet (A-Za-z0-9_-)', () => {
    const code = nanoid(8)
    expect(code).toMatch(/^[A-Za-z0-9_-]{8}$/)
  })

  it('produces different values on repeated calls (probabilistic — 5 attempts)', () => {
    const codes = Array.from({ length: 5 }, () => nanoid(8))
    const uniqueCodes = new Set(codes)
    // With 64^8 ≈ 281 trillion combinations, the probability of a collision in 5 calls is negligible
    expect(uniqueCodes.size).toBeGreaterThan(1)
  })
})
