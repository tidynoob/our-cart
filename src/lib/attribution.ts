/**
 * Attribution utilities for the two-person grocery list.
 *
 * Provides deterministic color assignment from a person's name and
 * initials extraction. Designed for a 2-person household where each
 * person sees a consistent color for their items.
 *
 * Per D-07 and UI spec: small colored initials badge next to each item.
 * Per review concern #4: uses a stable hash resistant to name variants
 * (e.g., "Mitch" and "Mitchell" map to the same color slot).
 */

/** Two-slot color palette for the two-person use case. */
export const PERSON_COLORS = [
  { bg: 'oklch(0.75 0.15 250)', text: 'oklch(0.30 0.10 250)' }, // Blue (slot 0)
  { bg: 'oklch(0.80 0.15 150)', text: 'oklch(0.35 0.10 150)' }, // Green (slot 1)
] as const

/**
 * Computes a stable color slot (0 or 1) from a name string.
 *
 * Uses the average character code (floored) mod 2, which provides
 * stability across name variants like nicknames vs full names
 * (e.g., "Mitch" and "Mitchell" both hash to the same slot).
 */
export function getColorSlot(name: string): number {
  if (name.length === 0) return 0
  let sum = 0
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i)
  }
  return Math.floor(sum / name.length) % 2
}

/**
 * Returns a deterministic color object (bg + text) for a person's name.
 * Same name always returns the same color. Resistant to nickname variants.
 */
export function getAttributionColor(name: string): {
  bg: string
  text: string
} {
  const slot = getColorSlot(name)
  return PERSON_COLORS[slot]
}

/**
 * Extracts the first character of a name as an uppercase initial.
 */
export function getInitials(name: string): string {
  return name.charAt(0).toUpperCase()
}
