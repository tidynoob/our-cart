import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface DeleteConfirmationProps {
  itemId: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Inline delete confirmation row replacing the item row content.
 * Shows "Delete this item?" with Cancel and Delete buttons.
 *
 * Per D-11: delete requires confirmation before removal.
 * Per UI spec: light red background, Cancel + Delete buttons.
 * Buttons use onMouseDown preventDefault to prevent blur propagation
 * to the parent edit row's focus-scope pattern.
 */
export function DeleteConfirmation({ itemId: _itemId, onCancel, onConfirm }: DeleteConfirmationProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Auto-focus Cancel button on mount (safest default per accessibility)
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      className="flex min-h-[48px] items-center justify-between px-3 py-2"
      style={{ backgroundColor: 'oklch(0.95 0.05 27)' }}
    >
      <span className="text-sm">Delete this item?</span>
      <div className="flex items-center gap-2">
        <Button
          ref={cancelRef}
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onConfirm}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
