import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatus } from './SyncStatus'
import { useItemsStore } from '@/stores/itemsStore'

vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: vi.fn((selector: (s: { syncStatus: string }) => unknown) =>
    selector({ syncStatus: 'live' })
  ),
}))

describe('SyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default mock to 'live'
    vi.mocked(useItemsStore).mockImplementation(
      (selector: (s: { syncStatus: string }) => unknown) =>
        selector({ syncStatus: 'live' })
    )
  })

  it('renders "Live" text when syncStatus is "live" (SYNC-03)', () => {
    render(<SyncStatus />)
    expect(screen.getByText('Live')).toBeTruthy()
  })

  it('renders "Connecting…" text when syncStatus is "connecting" (SYNC-03)', () => {
    vi.mocked(useItemsStore).mockImplementation(
      (selector: (s: { syncStatus: string }) => unknown) =>
        selector({ syncStatus: 'connecting' })
    )
    render(<SyncStatus />)
    expect(screen.getByText('Connecting…')).toBeTruthy()
  })

  it('renders "Reconnecting…" text when syncStatus is "reconnecting" (SYNC-03)', () => {
    vi.mocked(useItemsStore).mockImplementation(
      (selector: (s: { syncStatus: string }) => unknown) =>
        selector({ syncStatus: 'reconnecting' })
    )
    render(<SyncStatus />)
    expect(screen.getByText('Reconnecting…')).toBeTruthy()
  })
})
