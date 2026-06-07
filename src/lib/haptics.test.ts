import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerHaptic } from './haptics'

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, QOL-03 / D-12): triggerHaptic feature-detects navigator.vibrate,
// fires a short pulse when supported, and is a silent no-op (no throw) on iOS /
// desktop / throwing WebViews. The module does not exist yet — this fails at
// import until haptics.ts lands (Wave 1).
// ──────────────────────────────────────────────────────────────────────────

describe('triggerHaptic (QOL-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Remove any vibrate we defined; restore any stubbed globals.
    delete (navigator as unknown as { vibrate?: unknown }).vibrate
    vi.unstubAllGlobals()
  })

  it('calls navigator.vibrate(15) when vibrate is supported', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, configurable: true })

    triggerHaptic()

    expect(vibrateMock).toHaveBeenCalledTimes(1)
    expect(vibrateMock).toHaveBeenCalledWith(15)
  })

  it('does NOT throw when navigator.vibrate is absent (iOS / desktop)', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate
    expect('vibrate' in navigator).toBe(false)

    expect(() => triggerHaptic()).not.toThrow()
  })

  it('swallows a throwing vibrate implementation (some WebViews throw)', () => {
    const throwingVibrate = vi.fn(() => {
      throw new Error('vibrate not allowed')
    })
    Object.defineProperty(navigator, 'vibrate', { value: throwingVibrate, configurable: true })

    expect(() => triggerHaptic()).not.toThrow()
    expect(throwingVibrate).toHaveBeenCalled()
  })
})
