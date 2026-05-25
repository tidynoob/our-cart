import { describe, it, expect } from 'vitest'
import { getAttributionColor, getInitials, PERSON_COLORS, getColorSlot } from './attribution'

describe('getInitials', () => {
  it('returns uppercase first character of name', () => {
    expect(getInitials('Mitch')).toBe('M')
    expect(getInitials('sarah')).toBe('S')
  })

  it('handles single character names', () => {
    expect(getInitials('A')).toBe('A')
  })

  it('returns "?" for an empty name so the badge is never blank', () => {
    expect(getInitials('')).toBe('?')
  })
})

describe('getAttributionColor', () => {
  it('returns object with bg and text properties', () => {
    const color = getAttributionColor('Mitch')
    expect(color).toHaveProperty('bg')
    expect(color).toHaveProperty('text')
    expect(typeof color.bg).toBe('string')
    expect(typeof color.text).toBe('string')
  })

  it('same name always returns same color (deterministic)', () => {
    const color1 = getAttributionColor('Mitch')
    const color2 = getAttributionColor('Mitch')
    expect(color1).toEqual(color2)
  })

  it('produces different colors for two typical couple names (e.g., "Mitch" vs "Sarah")', () => {
    const mitchColor = getAttributionColor('Mitch')
    const sarahColor = getAttributionColor('Sarah')
    expect(mitchColor).not.toEqual(sarahColor)
  })
})

describe('getColorSlot', () => {
  it('returns 0 or 1', () => {
    const slot = getColorSlot('Mitch')
    expect([0, 1]).toContain(slot)
  })

  it('is consistent for the same name', () => {
    expect(getColorSlot('Mitch')).toBe(getColorSlot('Mitch'))
  })
})

describe('PERSON_COLORS', () => {
  it('has exactly 2 color slots', () => {
    expect(PERSON_COLORS).toHaveLength(2)
  })

  it('each slot has bg and text properties', () => {
    for (const color of PERSON_COLORS) {
      expect(color).toHaveProperty('bg')
      expect(color).toHaveProperty('text')
    }
  })
})
