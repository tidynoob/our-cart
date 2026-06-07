import { cn } from '@/lib/utils'

interface SpinnerProps {
  /** Accessible label and visible text prefix. Default: "Loading" */
  label?: string
  /** Controls text size. "sm" → text-sm, "md" → text-base (default). */
  size?: 'sm' | 'md'
  /** Optional className forwarded to the container div. */
  className?: string
}

/**
 * Accessible loading indicator.
 *
 * Renders a text-based spinner with role="status" so screen readers announce
 * the loading state without interrupting (aria-live="polite" is implicit on
 * role="status"). Text-only per Phase 11 scope (Assumption A4 — animated
 * ring deferred).
 *
 * Usage:
 *   <Spinner />                              → "Loading..."
 *   <Spinner label="Loading items" size="sm" />  → "Loading items..."
 */
export function Spinner({ label = 'Loading', size = 'md', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex items-center justify-center', className)}
    >
      <span
        className={cn(
          'text-muted-foreground',
          size === 'sm' ? 'text-sm' : 'text-base'
        )}
      >
        {label}...
      </span>
    </div>
  )
}
