import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateListForm from './CreateListForm'

const mockInsert = vi.fn()
const mockFrom = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table)
      return {
        insert: mockInsert,
      }
    },
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('CreateListForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT call supabase.from when name is empty', async () => {
    render(<CreateListForm />)
    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)
    // No async wait needed — validation is synchronous
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls supabase.from("lists").insert with name and an 8-char share code', async () => {
    mockInsert.mockResolvedValueOnce({ error: null })

    render(<CreateListForm />)
    const input = screen.getByLabelText(/list name/i)
    fireEvent.change(input, { target: { value: 'My List' } })

    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('lists')
      expect(mockInsert).toHaveBeenCalledWith({
        name: 'My List',
        share_code: expect.stringMatching(/^[A-Za-z0-9_-]{8}$/),
      })
    })
  })

  it('navigates to /list/<8-char-code> after successful INSERT', async () => {
    mockInsert.mockResolvedValueOnce({ error: null })

    render(<CreateListForm />)
    const input = screen.getByLabelText(/list name/i)
    fireEvent.change(input, { target: { value: 'Grocery Run' } })

    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/list\/[A-Za-z0-9_-]{8}$/),
      )
    })
  })

  it('renders "Could not create list" text on Supabase error — does not expose raw error', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { message: 'duplicate key value violates unique constraint' },
    })

    render(<CreateListForm />)
    const input = screen.getByLabelText(/list name/i)
    fireEvent.change(input, { target: { value: 'Test List' } })

    const button = screen.getByRole('button', { name: /create list/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/could not create list/i)).toBeTruthy()
    })

    // Raw Supabase error must NOT appear
    expect(
      screen.queryByText(/duplicate key value/i),
    ).toBeNull()
  })
})
