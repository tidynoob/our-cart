import type { Item } from '@/types/item'
import { AttributionBadge } from '@/components/AttributionBadge'

interface ItemRowProps {
  item: Item
  isEditing: boolean
  onTap: () => void
}

/**
 * Single item row displaying attribution badge, item name, and optional quantity.
 * Display mode only for Plan 02 -- edit mode rendering will be added in Plan 03.
 *
 * Per D-07: colored initials badge to the left of item name.
 * Per D-09: tap enters edit mode (wired in Plan 03).
 * Per UI spec: min 48px row height for tap targets.
 */
export function ItemRow({ item, isEditing: _isEditing, onTap }: ItemRowProps) {
  return (
    <div
      className="flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-border px-3 py-2 hover:bg-secondary active:bg-secondary"
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        }
      }}
    >
      {item.added_by ? (
        <AttributionBadge name={item.added_by} />
      ) : (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          aria-label="Unknown person added this"
        >
          ?
        </div>
      )}
      <span className="flex-1 text-base">{item.name}</span>
      {item.quantity && (
        <span className="text-sm text-muted-foreground">{item.quantity}</span>
      )}
    </div>
  )
}
