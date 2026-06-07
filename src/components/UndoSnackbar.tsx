import { useEffect } from 'react'
import { useItemsStore } from '@/stores/itemsStore'
import { Button } from '@/components/ui/button'

/**
 * Undo-clear snackbar (SHOP-05 / D-02).
 *
 * A transient `role="status"` live region driven entirely by itemsStore's
 * `lastCleared` buffer. Renders only while the buffer is non-empty — i.e. only
 * to the user who cleared, never the partner (D-02). Tapping Undo restores the
 * cleared items (`undoClear`); after 5s the buffer auto-clears (`clearLastCleared`)
 * and the snackbar disappears. No countdown bar (UI-SPEC §1 — keep minimal).
 *
 * Neutral muted surface (NOT amber/destructive — UI-SPEC §1/Color); the accent
 * lives only on the Undo affordance.
 */
export function UndoSnackbar() {
  const lastCleared = useItemsStore((state) => state.lastCleared)
  const undoClear = useItemsStore((state) => state.undoClear)
  const clearLastCleared = useItemsStore((state) => state.clearLastCleared)

  const count = lastCleared.length

  // 5s auto-dismiss timer (D-02). Keyed on the buffer + clearLastCleared so a
  // new clear restarts the window and an unmount/buffer-change cancels the prior
  // timer — no stale timer firing into a different list (RESEARCH Pitfall 2).
  useEffect(() => {
    if (lastCleared.length === 0) return
    const timer = setTimeout(() => clearLastCleared(), 5000)
    return () => clearTimeout(timer)
  }, [lastCleared, clearLastCleared])

  if (count === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-2 rounded-md border bg-muted p-3 text-sm"
    >
      <span>
        Cleared {count} item{count !== 1 ? 's' : ''}.
      </span>
      <Button
        variant="ghost"
        onClick={undoClear}
        aria-label="Undo clear"
        className="min-h-[44px] text-primary font-semibold"
      >
        Undo
      </Button>
    </div>
  )
}
