/**
 * Display name resolution utilities.
 *
 * Extracts the inline resolveDisplayName function from ListPage.tsx into a
 * shared module. Consumed by ListPage, Sidebar, and profilesStore resolution.
 */
import type { User } from '@supabase/supabase-js'

/**
 * Resolves the best available display name from a Supabase Auth User object.
 *
 * Priority chain (D-10): display_name > full_name > name > email prefix > 'Unknown'.
 * All fields are sourced from user_metadata (Google OAuth) which may omit any
 * field — every step uses nullish coalescing to guarantee a non-empty string.
 */
export function resolveDisplayName(u: User): string {
  return (
    u.user_metadata?.display_name ??
    u.user_metadata?.full_name ??
    u.user_metadata?.name ??
    u.email?.split('@')[0] ??
    'Unknown'
  )
}

/**
 * Resolves a display name from a profilesStore profile entry.
 *
 * Used for cross-user attribution where we have a profile row (from the
 * public.profiles table) rather than the full Auth User object.
 *
 * Returns 'Unknown' when profile is undefined or display_name is null.
 */
export function resolveProfileName(
  profile: { display_name: string | null } | undefined
): string {
  return profile?.display_name ?? 'Unknown'
}
