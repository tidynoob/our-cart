import { describe, it, expect, afterEach } from 'vitest'
import { isIosSafari, isStandalone } from '@/lib/pwa'

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, PWA-01 / SC-3,SC-4): isIosSafari() / isStandalone() are pure
// feature-detect helpers that disambiguate iOS-Safari (incl. iPadOS-as-Mac) from
// in-app browsers / desktop, and detect standalone launch via navigator.standalone
// (iOS) or matchMedia('(display-mode: standalone)') (everyone else). The module
// `@/lib/pwa` does not exist yet — this fails at import until pwa.ts lands (Wave 1).
//
// Cases driven by stubbing navigator.userAgent, navigator.standalone, and a
// window.matchMedia stub (jsdom does NOT implement matchMedia) via
// Object.defineProperty, cleaned up in afterEach.
// ──────────────────────────────────────────────────────────────────────────

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IOS_CHROME_CRIOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1'
const IOS_FIREFOX_FXIOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/604.1'
const IOS_EDGE_EDGIOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 EdgiOS/124.0 Mobile/15E148 Safari/604.1'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

function setUserAgent(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}

function setStandaloneProp(value: boolean | undefined): void {
  Object.defineProperty(navigator, 'standalone', { value, configurable: true })
}

// Provide an explicit matchMedia stub — jsdom does not implement it. `matches`
// is true only when the queried string includes 'standalone' AND the flag is set.
function stubMatchMedia(standaloneMatches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: standaloneMatches && query.includes('standalone'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
    writable: true,
  })
}

// Toggle 'ontouchend' on document to simulate a touch-capable (iPadOS-as-Mac) device.
function setTouchCapable(touch: boolean): void {
  if (touch) {
    Object.defineProperty(document, 'ontouchend', { value: null, configurable: true })
  } else {
    delete (document as unknown as { ontouchend?: unknown }).ontouchend
  }
}

afterEach(() => {
  // Restore the navigator UA / standalone and clear our window.matchMedia + touch stubs.
  delete (navigator as unknown as { userAgent?: unknown }).userAgent
  delete (navigator as unknown as { standalone?: unknown }).standalone
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
  setTouchCapable(false)
})

describe('isIosSafari (PWA-01 / SC-3 truth table)', () => {
  it('returns true for an iPhone Safari user agent', () => {
    setUserAgent(IPHONE_SAFARI)
    setTouchCapable(false)
    expect(isIosSafari()).toBe(true)
  })

  it('returns false for Chrome on iOS (CriOS) — cannot A2HS the Safari way', () => {
    setUserAgent(IOS_CHROME_CRIOS)
    expect(isIosSafari()).toBe(false)
  })

  it('returns false for Firefox on iOS (FxiOS)', () => {
    setUserAgent(IOS_FIREFOX_FXIOS)
    expect(isIosSafari()).toBe(false)
  })

  it('returns false for Edge on iOS (EdgiOS)', () => {
    setUserAgent(IOS_EDGE_EDGIOS)
    expect(isIosSafari()).toBe(false)
  })

  it('returns true for a Macintosh UA WITH touch (iPadOS-13+ reports as Mac)', () => {
    setUserAgent(MAC_SAFARI)
    setTouchCapable(true)
    expect(isIosSafari()).toBe(true)
  })

  it('returns false for a plain desktop Mac (no touch)', () => {
    setUserAgent(MAC_SAFARI)
    setTouchCapable(false)
    expect(isIosSafari()).toBe(false)
  })
})

describe('isStandalone (PWA-01 / SC-4 truth table)', () => {
  it('returns true when navigator.standalone === true (iOS launched standalone)', () => {
    setStandaloneProp(true)
    stubMatchMedia(false)
    expect(isStandalone()).toBe(true)
  })

  it('returns true when matchMedia("(display-mode: standalone)").matches is true', () => {
    setStandaloneProp(undefined)
    stubMatchMedia(true)
    expect(isStandalone()).toBe(true)
  })

  it('returns false when neither navigator.standalone nor the media query match', () => {
    setStandaloneProp(undefined)
    stubMatchMedia(false)
    expect(isStandalone()).toBe(false)
  })
})
