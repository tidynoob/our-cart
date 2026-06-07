/**
 * Haptic feedback helper (QOL-03 / D-12).
 *
 * Thin, feature-detected wrapper over the Vibration API. Used to give a short
 * tactile pulse on a successful check-off (mobile). The fire-direction
 * (check-ON only) is the caller's concern — this helper just fires when asked.
 */

/**
 * Fire a short haptic pulse via the Vibration API when supported.
 *
 * No-ops silently on iOS Safari and desktop browsers (which expose no
 * `navigator.vibrate`) and swallows throws from embedded WebViews that expose
 * but disallow `vibrate`. Requires sticky user activation — a checkbox tap
 * qualifies — so calling it from a tap handler is the supported usage.
 *
 * @param durationMs Pulse length in milliseconds (default 15ms per D-12).
 */
export function triggerHaptic(durationMs = 15): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(durationMs)
  } catch {
    // Haptic is non-essential — some WebViews expose vibrate but throw on call.
    // Swallow so a missing pulse never breaks the check-off flow.
  }
}
