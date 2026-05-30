import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShareBanner } from './ShareBanner'

const mockDismissBanner = vi.fn()

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    dismissBanner: mockDismissBanner,
    dismissedBanners: new Set<string>(),
  })),
}))

const DEFAULT_PROPS = {
  listCode: 'ABC12345',
  listName: 'Grocery Run',
  onDismiss: vi.fn(),
}

describe('ShareBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Remove navigator.share by default so tests run cleanly
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  it('renders the listCode value as visible text', () => {
    render(<ShareBanner {...DEFAULT_PROPS} />)
    expect(screen.getByText('ABC12345')).toBeTruthy()
  })

  it('clicking "Copy link" calls navigator.clipboard.writeText with the full URL containing listCode', async () => {
    render(<ShareBanner {...DEFAULT_PROPS} />)
    const copyButton = screen.getByRole('button', { name: /copy link/i })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('ABC12345'),
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/invite/ABC12345'),
      )
    })
  })

  it('clicking "Dismiss" calls the onDismiss prop', () => {
    const onDismiss = vi.fn()
    render(<ShareBanner {...DEFAULT_PROPS} onDismiss={onDismiss} />)

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('"Share" button is absent when navigator.share is undefined', () => {
    // navigator.share is already set to undefined in beforeEach
    render(<ShareBanner {...DEFAULT_PROPS} />)
    // Use exact "Share" label — avoids matching "Dismiss share banner" aria-label
    expect(screen.queryByRole('button', { name: /^share$/i })).toBeNull()
  })

  it('"Share" button is present when navigator.share is a function', () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    })

    render(<ShareBanner {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: /^share$/i })).toBeTruthy()
  })
})
