import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, QOL-02 / D-10): usePreferencesStore is a persisted zustand store
// (localStorage key `our-cart-prefs`) that does not exist yet. These fail at
// import (module missing) until preferencesStore.ts lands (Wave 1).
//
// Contracts pinned:
//   (a) defaults checkedToBottom:false; setCheckedToBottom / toggleCheckedToBottom flip it
//   (b) persists to localStorage key `our-cart-prefs`
//   (c) seeded-value-on-creation: a value written to localStorage BEFORE the store
//       module is imported is read on hydration (no flash, A3)
//   (d) unavailable-storage fallback (safeLocalStorage): a throwing localStorage.setItem
//       does not break the store
//
// Persist hydrates at store-creation (module eval), so the seeded-value case must
// seed localStorage, then dynamic-import the store after vi.resetModules().
// ──────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'our-cart-prefs'

describe('preferencesStore — defaults + actions (QOL-02)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('defaults checkedToBottom to false', async () => {
    const { usePreferencesStore } = await import('./preferencesStore')
    expect(usePreferencesStore.getState().checkedToBottom).toBe(false)
  })

  it('setCheckedToBottom(true) sets the flag to true', async () => {
    const { usePreferencesStore } = await import('./preferencesStore')
    usePreferencesStore.getState().setCheckedToBottom(true)
    expect(usePreferencesStore.getState().checkedToBottom).toBe(true)
  })

  it('toggleCheckedToBottom flips the flag', async () => {
    const { usePreferencesStore } = await import('./preferencesStore')
    expect(usePreferencesStore.getState().checkedToBottom).toBe(false)
    usePreferencesStore.getState().toggleCheckedToBottom()
    expect(usePreferencesStore.getState().checkedToBottom).toBe(true)
    usePreferencesStore.getState().toggleCheckedToBottom()
    expect(usePreferencesStore.getState().checkedToBottom).toBe(false)
  })

  it('persists checkedToBottom to localStorage key our-cart-prefs', async () => {
    const { usePreferencesStore } = await import('./preferencesStore')
    usePreferencesStore.getState().setCheckedToBottom(true)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    // zustand persist envelope: { state: {...}, version }
    expect(parsed.state.checkedToBottom).toBe(true)
  })
})

describe('preferencesStore — seeded value on creation (A3, no flash)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('reads checkedToBottom:true from a value seeded BEFORE the store import', async () => {
    // Seed the persisted envelope before the module is evaluated so persist hydrates it.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { checkedToBottom: true }, version: 0 }),
    )

    const { usePreferencesStore } = await import('./preferencesStore')

    // No flash: the store reads true on creation, not the false default.
    expect(usePreferencesStore.getState().checkedToBottom).toBe(true)
  })
})

describe('preferencesStore — unavailable storage fallback (safeLocalStorage)', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    // Simulate Safari private mode / quota: setItem throws.
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
  })

  afterEach(() => {
    setItemSpy.mockRestore()
  })

  it('stays usable when localStorage.setItem throws (does not crash the store)', async () => {
    const { usePreferencesStore } = await import('./preferencesStore')

    // The store must remain operable even though persistence fails silently.
    expect(() => usePreferencesStore.getState().setCheckedToBottom(true)).not.toThrow()
    expect(usePreferencesStore.getState().checkedToBottom).toBe(true)
  })
})
