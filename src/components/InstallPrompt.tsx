import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isStandalone } from '@/lib/pwa'

/**
 * Android install affordance (PWA-01 / SC-2 / D-10).
 *
 * Captures the Chromium `beforeinstallprompt` event (preventDefault + stash),
 * then surfaces a custom Install button that fires the stashed `prompt()` on
 * tap — the auto mini-infobar will NOT fire with our handler-free SW, so the
 * button (plus the ⋮ menu) is the real install mechanism. Hides once
 * `appinstalled` fires, when running standalone, or after a session dismiss.
 *
 * Neutral muted surface (clone of UndoSnackbar) with the accent confined to the
 * Install label only (UI-SPEC §1). Dismissal is session-only (useState) — NOT
 * persisted (contrast IosInstallBanner). Install/SW is best-effort: a rejected
 * `prompt()` is swallowed silently (UI-SPEC "Error state: N/A (silent)").
 */

// `BeforeInstallPromptEvent` is not in the TS DOM lib — declare the minimal
// surface we rely on.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [canInstall, setCanInstall] = useState(false)
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      // Suppress the default mini-infobar and stash for our custom button.
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    const onAppInstalled = () => {
      setCanInstall(false)
      deferredPrompt.current = null
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function handleInstall() {
    try {
      await deferredPrompt.current?.prompt()
    } catch {
      // Install is best-effort — swallow a rejected prompt(), no error UI.
    }
  }

  if (!canInstall || sessionDismissed || isStandalone()) return null

  return (
    <div
      role="region"
      aria-label="Install app"
      className="flex items-center justify-between gap-2 rounded-md border bg-muted p-3 text-sm"
    >
      <div className="flex flex-col gap-1">
        <span>Install Our Cart</span>
        <span className="text-sm text-muted-foreground">
          Add it to your home screen.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={handleInstall}
          className="min-h-[44px] text-primary font-semibold"
        >
          <Download className="size-4" aria-hidden="true" />
          Install
        </Button>
        <Button
          variant="ghost"
          onClick={() => setSessionDismissed(true)}
          aria-label="Dismiss install prompt"
          className="min-h-[44px]"
        >
          Not now
        </Button>
      </div>
    </div>
  )
}

export default InstallPrompt
