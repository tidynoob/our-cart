/**
 * Extracts the share code from a user-supplied input string.
 * Handles three input formats:
 *   - Full URL:    "https://our-cart.vercel.app/list/ABC12345" → "ABC12345"
 *   - Path-style:  "our-cart.vercel.app/list/ABC12345"        → "ABC12345"
 *   - Raw code:    "ABC12345"                                  → "ABC12345"
 *
 * Case is preserved (Pitfall 6: never normalize the share code).
 */
export function extractShareCode(input: string): string {
  const trimmed = input.trim()
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean)
    return segments[segments.length - 1]
  }
  return trimmed
}
