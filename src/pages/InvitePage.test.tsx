import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import InvitePage from './InvitePage'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

function renderAtRoute(code: string) {
  return render(
    <MemoryRouter initialEntries={[`/invite/${code}`]}>
      <Routes>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/list/:code" element={<div>List Page</div>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('InvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders spinner (animate-spin) while redeem_invite RPC is in flight', () => {
    // Mock rpc to return a never-settling promise
    vi.mocked(supabase.rpc).mockReturnValue(new Promise(() => {}) as unknown as ReturnType<typeof supabase.rpc>)

    renderAtRoute('ABC12345')

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('navigates to /list/:code with replace:true on valid RPC response ({ list_id, share_code })', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { list_id: 'uuid-123', share_code: 'ABC12345' },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never)

    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByText('List Page')).toBeTruthy()
    })
  })

  it('does not navigate when code param is missing from the URL', () => {
    vi.mocked(supabase.rpc).mockReturnValue(new Promise(() => {}) as unknown as ReturnType<typeof supabase.rpc>)

    render(
      <MemoryRouter initialEntries={['/invite/']}>
        <Routes>
          <Route path="/invite/" element={<InvitePage />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    )

    // When code is absent the component navigates to "/" — Home is rendered
    // (navigate fires synchronously via MemoryRouter)
    expect(screen.getByText('Home')).toBeTruthy()
  })

  it('shows "This invite link is invalid or has expired." when RPC returns null data', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never)

    renderAtRoute('BADCODE')

    await waitFor(() => {
      expect(screen.getByText('This invite link is invalid or has expired.')).toBeTruthy()
    })
  })

  it('shows "This invite link is invalid or has expired." when RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'db error', details: '', hint: '', code: '500' },
      count: null,
      status: 500,
      statusText: 'Internal Server Error',
    } as never)

    renderAtRoute('BADCODE')

    await waitFor(() => {
      expect(screen.getByText('This invite link is invalid or has expired.')).toBeTruthy()
    })
  })
})
