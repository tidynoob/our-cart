import { useState } from 'react'
import { getAttributionColor, getInitials } from '@/lib/attribution'
import { cn } from '@/lib/utils'

interface AttributionBadgeProps {
  name: string
  avatarUrl?: string
  className?: string
}

/**
 * Colored circle displaying a person's initial with accessible labeling.
 * Color is deterministic from the name (same name always gets same color).
 * Per D-07 and accessibility spec: aria-label "{name} added this".
 *
 * When avatarUrl is provided and loads successfully, renders a circular avatar
 * image with referrerPolicy="no-referrer" (required for Google CDN — returns 403
 * without this header per RESEARCH.md Pitfall 1).
 * Falls back to colored-initial badge on onError or when avatarUrl is absent.
 */
export function AttributionBadge({ name, avatarUrl, className }: AttributionBadgeProps) {
  const [imgError, setImgError] = useState(false)
  const color = getAttributionColor(name)
  // Guard: onError never fires for empty/undefined src (Pitfall 2)
  const showImg = avatarUrl && !imgError

  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden',
        className
      )}
      style={!showImg ? { backgroundColor: color.bg, color: color.text } : undefined}
      aria-label={`${name} added this`}
    >
      {showImg ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover rounded-full"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}
