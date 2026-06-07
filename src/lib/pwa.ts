/**
 * PWA install detection helpers (PWA-01 / D-11, SC-3, SC-4).
 *
 * Pure, feature-detected predicates that the install surfaces consume to decide
 * visibility. Mirrors haptics.ts: guard every browser-API access with a
 * `typeof`/`in` check so SSR/jsdom/unsupported contexts never throw.
 */

/**
 * True when the app is running as an installed standalone PWA.
 *
 * iOS exposes the non-standard `navigator.standalone`; every other platform
 * reports via the `(display-mode: standalone)` media query. Optional-chains
 * `matchMedia` (jsdom does not implement it) and guards `navigator`/`window`.
 */
export function isStandalone(): boolean {
  const iosStandalone =
    typeof navigator !== 'undefined' &&
    (navigator as { standalone?: boolean }).standalone === true
  const mediaStandalone =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches === true
  return iosStandalone || mediaStandalone
}

/**
 * True only on iOS Safari (the one iOS browser that can Add-to-Home-Screen the
 * documented way).
 *
 * Disambiguates the iPadOS-13+ "reports as Macintosh" case via a touch probe
 * (`'ontouchend' in document`), and excludes the in-app / non-Safari iOS
 * browsers (Chrome=CriOS, Firefox=FxiOS, Edge=EdgiOS, Opera=OPiOS) which cannot
 * A2HS through the Share sheet. Returns false when `navigator` is undefined.
 */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIosDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') &&
      typeof document !== 'undefined' &&
      // Own-property check (not `in`): a desktop Mac has no touch handler, while
      // iPadOS-13+ Safari exposes `ontouchend` on the document. jsdom carries
      // `ontouchend` on the prototype, so a bare `in` is always true there —
      // hasOwnProperty is the discriminator that tracks the real touch signal.
      Object.prototype.hasOwnProperty.call(document, 'ontouchend'))
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIosDevice && isSafari
}
