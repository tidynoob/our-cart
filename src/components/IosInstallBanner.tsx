import { useState } from 'react'
import { Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isIosSafari, isStandalone } from '@/lib/pwa'

/**
 * iOS Safari Add-to-Home-Screen banner (PWA-01 / SC-3 / D-11, D-12).
 *
 * iOS Safari has no `beforeinstallprompt`, so we show a manual instruction
 * banner ("Tap the Share button then Add to Home Screen") only on iOS Safari,
 * not in standalone, and not after dismissal. Clones ShareBanner's info-blue
 * surface; the accent stays text-only (UI-SPEC §2 — no destructive/amber).
 *
 * Dismissal persists to a dedicated key via a crash-safe safeLocalStorage probe
 * + in-memory fallback (Phase-14 pattern) — never bare `localStorage`. Safari
 * private mode / quota throwing on write does not crash the dismissal.
 */

const DISMISS_KEY = 'our-cart-ios-a2hs-dismissed'

/**
 * Crash-safe localStorage wrapper (lifted from preferencesStore's probe shape).
 *
 * Probes once; on any throw (Safari private mode / quota) falls back to a
 * Map-backed in-memory Storage so reads/writes never crash.
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
    const probeKey = '__our-cart-a2hs-probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return window.localStorage
  } catch {
    return memoryStorage
  }
}

const safeLocalStorage = createSafeLocalStorage()

function readDismissed(): boolean {
  try {
    return safeLocalStorage.getItem(DISMISS_KEY) === 'true'
  } catch {
    return false
  }
}

export function IosInstallBanner() {
  // Read the persisted flag once on mount.
  const [dismissed, setDismissed] = useState<boolean>(readDismissed)

  function handleDismiss() {
    // Best-effort persist — a throwing setItem (quota / private mode) must not
    // crash the dismissal; the banner still hides for the session.
    try {
      safeLocalStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      // swallow — dismissal is device-local view state, non-essential to persist
    }
    setDismissed(true)
  }

  if (!isIosSafari() || isStandalone() || dismissed) return null

  return (
    <div
      className="w-full bg-blue-50 border-b border-blue-200 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      role="banner"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm">Install Our Cart</span>
        <span className="text-sm">
          Tap the Share button{' '}
          <Share className="inline-flex items-center size-4" aria-hidden="true" />{' '}
          then "Add to Home Screen".
        </span>
      </div>

      {/* No aria-label: the visible "Got it" text is the accessible name (the
          RED contract queries this control by /^Got it$/). An aria-label would
          override the visible text and break that query, so we rely on the
          self-describing label instead. */}
      <Button variant="ghost" size="sm" onClick={handleDismiss}>
        Got it
      </Button>
    </div>
  )
}

export default IosInstallBanner
