import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './uiStore'

describe('uiStore — dismissBanner', () => {
  beforeEach(() => {
    useUIStore.setState({ dismissedBanners: new Set() })
  })

  it('adds the code to dismissedBanners', () => {
    useUIStore.getState().dismissBanner('abc123')
    expect(useUIStore.getState().dismissedBanners.has('abc123')).toBe(true)
  })

  it('creates a new Set reference after dismiss (Zustand reactivity)', () => {
    const before = useUIStore.getState().dismissedBanners
    useUIStore.getState().dismissBanner('abc123')
    const after = useUIStore.getState().dismissedBanners
    expect(after).not.toBe(before)
  })
})

describe('uiStore — restoreBanner', () => {
  beforeEach(() => {
    useUIStore.setState({ dismissedBanners: new Set(['abc123']) })
  })

  it('removes the code from dismissedBanners (NAV-03)', () => {
    useUIStore.getState().restoreBanner('abc123')
    expect(useUIStore.getState().dismissedBanners.has('abc123')).toBe(false)
  })

  it('returns a new Set reference (triggers Zustand reactivity)', () => {
    const before = useUIStore.getState().dismissedBanners
    useUIStore.getState().restoreBanner('abc123')
    const after = useUIStore.getState().dismissedBanners
    expect(after).not.toBe(before)
  })

  it('does not throw when restoring a code not in the Set', () => {
    expect(() => useUIStore.getState().restoreBanner('not-there')).not.toThrow()
  })
})
