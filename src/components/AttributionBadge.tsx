import { getAttributionColor, getInitials } from '@/lib/attribution'
import { cn } from '@/lib/utils'

interface AttributionBadgeProps {
  name: string
  className?: string
}

/**
 * Colored circle displaying a person's initial with accessible labeling.
 * Color is deterministic from the name (same name always gets same color).
 * Per D-07 and accessibility spec: aria-label "{name} added this".
 */
export function AttributionBadge({ name, className }: AttributionBadgeProps) {
  const color = getAttributionColor(name)

  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        className
      )}
      style={{ backgroundColor: color.bg, color: color.text }}
      aria-label={`${name} added this`}
    >
      {getInitials(name)}
    </div>
  )
}
