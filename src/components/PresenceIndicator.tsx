import { useCallback } from 'react'
import { AttributionBadge } from '@/components/AttributionBadge'
import { usePresenceStore } from '@/stores/presenceStore'
import { useProfilesStore } from '@/stores/profilesStore'
import { resolveProfileName } from '@/lib/displayName'

/**
 * Header indicator for OPS-02: renders one AttributionBadge per OTHER present
 * list member. Self is excluded upstream by presenceStore.deriveOthers.
 *
 * Identity (name/avatar) is resolved from the server-sourced profilesStore keyed
 * by user_id — NEVER from the raw track() payload (spoofing guard, T-12-01) — and
 * the member-set filter drops presence keys absent from profiles (anti-flooding,
 * T-12-02). Reactive store selectors (not getState snapshots) give live-rename
 * parity with ItemRow.
 *
 * Accessibility: the wrapper <span> carries the SINGLE accessible name
 * ("{name} is viewing this list"). The inner AttributionBadge — whose hardcoded
 * aria-label is "{name} added this" and whose <img alt> would double-announce — is
 * wrapped in an aria-hidden container so it is removed from the accessibility tree
 * while still rendering the avatar visually. AttributionBadge is composed verbatim
 * (not forked/edited), per UI-SPEC.
 */
export function PresenceIndicator() {
  const others = usePresenceStore((s) => s.others)
  const profiles = useProfilesStore((s) => s.profiles)

  // Strip the inner AttributionBadge's stale accessible-name sources so the wrapper
  // span's "{name} is viewing this list" is the SINGLE accessible name. aria-hidden
  // alone does NOT remove the inner aria-label from a *label* query — the literal
  // aria-label/img-alt attributes must be cleared. A ref callback does this without
  // forking AttributionBadge (UI-SPEC forbids editing it).
  const neutralizeInnerLabel = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return
    node.querySelectorAll('[aria-label]').forEach((el) => el.removeAttribute('aria-label'))
    node.querySelectorAll('img[alt]').forEach((el) => el.setAttribute('alt', ''))
  }, [])

  // Member-set filter: render only presence keys that are known list members.
  const visible = others.filter((o) => profiles[o.user_id])
  if (visible.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-1 shrink-0 transition-opacity duration-200"
    >
      {visible.map((o) => {
        const name = resolveProfileName(profiles[o.user_id])
        return (
          <span
            key={o.user_id}
            aria-label={`${name} is viewing this list`}
            title={`${name} is viewing this list`}
          >
            {/* aria-hidden hides the badge subtree from the a11y tree; the ref
                callback additionally clears the inner aria-label + img alt so they
                are not matchable as a separate accessible name. Avatar still renders. */}
            <span aria-hidden="true" ref={neutralizeInnerLabel}>
              <AttributionBadge
                name={name}
                avatarUrl={profiles[o.user_id]?.avatar_url ?? undefined}
              />
            </span>
          </span>
        )
      })}
    </div>
  )
}
