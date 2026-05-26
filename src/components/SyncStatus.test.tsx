import { describe, it, vi, beforeEach } from 'vitest'
// SyncStatus component is created in Plan 04-03.
// All tests in this file are .todo stubs until the component exists.
// The import below is commented out to keep the suite green during Wave 0.
// Uncomment when Plan 04-03 creates src/components/SyncStatus.tsx:
// import { SyncStatus } from './SyncStatus'

vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: vi.fn((selector: (s: { syncStatus: string }) => unknown) =>
    selector({ syncStatus: 'live' })
  ),
}))

describe('SyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.todo('renders "Live" text when syncStatus is "live" (SYNC-03)')
  it.todo('renders "Connecting…" text when syncStatus is "connecting" (SYNC-03)')
  it.todo('renders "Reconnecting…" text when syncStatus is "reconnecting" (SYNC-03)')
})
