/**
 * Device-local user preferences (QOL-02 / D-10).
 *
 * The project's FIRST persisted zustand store. Persists to localStorage under
 * `our-cart-prefs` via the `persist` middleware (ships inside the already-installed
 * zustand 5.0.13 — NO new dependency). Distinct from uiStore, which is intentionally
 * session-only and holds a non-JSON-clean `Set` (D-10) — do NOT fold prefs into it.
 *
 * Preferences here are device-local VIEW state only — never written to the DB or
 * synced to the partner.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface PreferencesState {
  /** When true, checked items sink to the bottom of their category section. */
  checkedToBottom: boolean
  setCheckedToBottom: (value: boolean) => void
  toggleCheckedToBottom: () => void
}

/**
 * A crash-safe localStorage wrapper (T-14-V2).
 *
 * Safari private mode and quota-exhausted storage throw on `setItem`, which would
 * otherwise crash store creation when persist probes/writes. We probe once; on any
 * throw we fall back to an in-memory Map-backed Storage shim so the store stays
 * usable (persistence silently becomes a no-op for the session).
 */
function createSafeLocalStorage(): Storage {
  const memory = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return memory.size
    },
    clear: () => memory.clear(),
    getItem: (key) => (memory.has(key) ? memory.get(key)! : null),
    key: (index) => Array.from(memory.keys())[index] ?? null,
    removeItem: (key) => memory.delete(key),
    setItem: (key, value) => {
      memory.set(key, String(value))
    },
  }

  try {
    if (typeof window === 'undefined' || !window.localStorage) return memoryStorage
    const probeKey = '__our-cart-prefs-probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return window.localStorage
  } catch {
    return memoryStorage
  }
}

const safeLocalStorage = createSafeLocalStorage()

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      checkedToBottom: false,
      setCheckedToBottom: (value) => set({ checkedToBottom: value }),
      toggleCheckedToBottom: () =>
        set((state) => ({ checkedToBottom: !state.checkedToBottom })),
    }),
    {
      name: 'our-cart-prefs',
      storage: createJSONStorage(() => safeLocalStorage),
      // Persist only data, never the action functions.
      partialize: (state) => ({ checkedToBottom: state.checkedToBottom }),
      // Coerce the rehydrated value defensively (T-14-V1): a user-tampered
      // localStorage entry holding a non-boolean is treated as false.
      merge: (persisted, current) => ({
        ...current,
        checkedToBottom:
          (persisted as { checkedToBottom?: unknown } | undefined)
            ?.checkedToBottom === true,
      }),
    }
  )
)
