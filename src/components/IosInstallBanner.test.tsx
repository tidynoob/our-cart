import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IosInstallBanner } from './IosInstallBanner'

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, PWA-01 / SC-3 / D-11,D-12): IosInstallBanner shows the iOS-Safari
// Add-to-Home-Screen banner iff `isIosSafari() && !isStandalone() && !dismissed`.
// Dismissal persists to a dedicated key `our-cart-ios-a2hs-dismissed` via a
// crash-safe safeLocalStorage probe (Safari private-mode / quota does NOT crash
// dismissal), and a remount with the key set stays hidden. The component
// `@/components/IosInstallBanner` does not exist yet — this fails at import until
// IosInstallBanner.tsx lands (Wave 1).
//
// isIosSafari/isStandalone are mocked per case; the test-setup MemoryStorage shim
// backs localStorage and resets between tests.
// ──────────────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'our-cart-ios-a2hs-dismissed'

const mockIsIosSafari = vi.fn(() => true)
const mockIsStandalone = vi.fn(() => false)

vi.mock('@/lib/pwa', () => ({
  isIosSafari: () => mockIsIosSafari(),
  isStandalone: () => mockIsStandalone(),
}))

describe('IosInstallBanner (PWA-01 / SC-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockIsIosSafari.mockReturnValue(true)
    mockIsStandalone.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the banner on iOS Safari, not standalone, not dismissed', () => {
    render(<IosInstallBanner />)
    // Exact-anchored label avoids matching the dismiss aria-label.
    expect(screen.getByRole('button', { name: /^Got it$/ })).toBeTruthy()
  })

  it('renders nothing when not iOS Safari (Android / desktop)', () => {
    mockIsIosSafari.mockReturnValue(false)
    const { container } = render(<IosInstallBanner />)
    expect(screen.queryByRole('button', { name: /^Got it$/ })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when already running standalone', () => {
    mockIsStandalone.mockReturnValue(true)
    const { container } = render(<IosInstallBanner />)
    expect(screen.queryByRole('button', { name: /^Got it$/ })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('clicking "Got it" persists "true" to our-cart-ios-a2hs-dismissed and hides the banner', async () => {
    const user = userEvent.setup()
    render(<IosInstallBanner />)

    await user.click(screen.getByRole('button', { name: /^Got it$/ }))

    expect(localStorage.getItem(DISMISS_KEY)).toBe('true')
    expect(screen.queryByRole('button', { name: /^Got it$/ })).toBeNull()
  })

  it('stays hidden on a remount when the dismissal key is already set', () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    const { container } = render(<IosInstallBanner />)
    expect(screen.queryByRole('button', { name: /^Got it$/ })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('does NOT crash when localStorage.setItem throws (QuotaExceeded) and still hides the banner', async () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    const user = userEvent.setup()
    render(<IosInstallBanner />)

    const dismiss = screen.getByRole('button', { name: /^Got it$/ })
    await act(async () => {
      await user.click(dismiss)
    })

    // safeLocalStorage fallback: the throw is swallowed, the banner still hides.
    expect(screen.queryByRole('button', { name: /^Got it$/ })).toBeNull()

    setItemSpy.mockRestore()
  })
})
