import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallPrompt } from './InstallPrompt'

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, PWA-01 / SC-2 / D-10): InstallPrompt captures the Android
// `beforeinstallprompt` event (preventDefault + stash), then renders a custom
// Install button driven off it; clicking Install calls the stashed prompt().
// `appinstalled` clears the affordance, and the component renders nothing while
// running standalone. The component `@/components/InstallPrompt` does not exist
// yet — this fails at import until InstallPrompt.tsx lands (Wave 1).
//
// `BeforeInstallPromptEvent` is not in the TS DOM lib — it is mocked here as a
// plain Event carrying prompt()/userChoice. isStandalone is mocked per case.
// ──────────────────────────────────────────────────────────────────────────

const mockIsStandalone = vi.fn(() => false)

vi.mock('@/lib/pwa', () => ({
  isStandalone: () => mockIsStandalone(),
  isIosSafari: () => false,
}))

// A minimal stand-in for the non-standard BeforeInstallPromptEvent. It extends
// Event so window.dispatchEvent carries it to the captured handler, and exposes
// the prompt()/userChoice surface the component awaits.
function makeBeforeInstallPromptEvent() {
  const promptMock = vi.fn().mockResolvedValue(undefined)
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: typeof promptMock
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = promptMock
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  return { event, promptMock }
}

describe('InstallPrompt (PWA-01 / SC-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStandalone.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing before any beforeinstallprompt event is captured', () => {
    const { container } = render(<InstallPrompt />)
    // Exact-anchored name avoids matching aria-labels like "Dismiss install prompt".
    expect(screen.queryByRole('button', { name: /^Install$/ })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the Install button after a beforeinstallprompt event is dispatched', () => {
    render(<InstallPrompt />)
    const { event } = makeBeforeInstallPromptEvent()

    act(() => {
      window.dispatchEvent(event)
    })

    expect(screen.getByRole('button', { name: /^Install$/ })).toBeTruthy()
  })

  it('clicking Install calls the stashed prompt()', async () => {
    const user = userEvent.setup()
    render(<InstallPrompt />)
    const { event, promptMock } = makeBeforeInstallPromptEvent()

    act(() => {
      window.dispatchEvent(event)
    })

    await user.click(screen.getByRole('button', { name: /^Install$/ }))

    expect(promptMock).toHaveBeenCalledTimes(1)
  })

  it('dispatching appinstalled removes the Install button', () => {
    render(<InstallPrompt />)
    const { event } = makeBeforeInstallPromptEvent()

    act(() => {
      window.dispatchEvent(event)
    })
    expect(screen.getByRole('button', { name: /^Install$/ })).toBeTruthy()

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(screen.queryByRole('button', { name: /^Install$/ })).toBeNull()
  })

  it('renders nothing when the app is already running standalone', () => {
    mockIsStandalone.mockReturnValue(true)
    const { container } = render(<InstallPrompt />)
    const { event } = makeBeforeInstallPromptEvent()

    // Even if the event fires, a standalone app must not offer install.
    act(() => {
      window.dispatchEvent(event)
    })

    expect(screen.queryByRole('button', { name: /^Install$/ })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
