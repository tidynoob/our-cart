import { describe, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

// InvitePage.tsx does not exist yet (Wave 3 creates it).
// These stubs define the RED-state Nyquist gate for SHARE-02.
// All tests are it.todo — the file compiles clean and exits 0,
// but the behaviour (animate-spin spinner, redeem_invite RPC, /list/:code navigate)
// is unimplemented until 10-03-PLAN.md.

describe('InvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.todo('renders spinner (animate-spin) while redeem_invite RPC is in flight')

  it.todo('navigates to /list/:code with replace:true on valid RPC response ({ list_id, share_code })')

  it.todo('shows "This invite link is invalid or has expired." when RPC returns null data')

  it.todo('shows "This invite link is invalid or has expired." when RPC returns an error')

  it.todo('does not navigate when code param is missing from the URL')
})
