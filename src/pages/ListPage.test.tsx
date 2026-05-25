import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ListPage from './ListPage'

const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table)
      return {
        select: (cols: string) => {
          mockSelect(cols)
          return {
            eq: (col: string, val: string) => {
              mockEq(col, val)
              return {
                single: mockSingle,
              }
            },
          }
        },
      }
    },
  },
}))

function renderAtRoute(code: string) {
  return render(
    <MemoryRouter initialEntries={[`/list/${code}`]}>
      <Routes>
        <Route path="/list/:code" element={<ListPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the list name when Supabase returns data (SHARE-02)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'Groceries',
        share_code: 'ABC12345',
        created_at: new Date().toISOString(),
      },
      error: null,
    })

    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy()
    })
  })

  it('shows generic "List not found" when Supabase returns an error — does not expose raw Supabase error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'internal Supabase error detail' },
    })

    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(screen.getByText('List not found')).toBeTruthy()
    })

    // The raw Supabase error message must NOT appear in the DOM
    expect(screen.queryByText('internal Supabase error detail')).toBeNull()
  })

  it('calls .eq with (share_code, code) without case normalization (SHARE-02, Pitfall 6)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'Groceries',
        share_code: 'ABC12345',
        created_at: new Date().toISOString(),
      },
      error: null,
    })

    renderAtRoute('ABC12345')

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('share_code', 'ABC12345')
    })

    // Confirm no case normalization — the exact mixed-case value from the URL is passed
    expect(mockEq).not.toHaveBeenCalledWith('share_code', 'abc12345')
    expect(mockEq).not.toHaveBeenCalledWith('share_code', 'ABC12345'.toLowerCase())
  })
})
