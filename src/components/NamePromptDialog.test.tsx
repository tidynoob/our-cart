import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NamePromptDialog } from './NamePromptDialog'

describe('NamePromptDialog', () => {
  const listId = 'test-list-123'
  const mockOnNameSaved = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
  })

  it('calls onNameSaved with trimmed name when Save is clicked', () => {
    render(<NamePromptDialog open={true} listId={listId} onNameSaved={mockOnNameSaved} />)

    const input = screen.getByPlaceholderText(/your name/i)
    fireEvent.change(input, { target: { value: '  Alice  ' } })

    const button = screen.getByRole('button', { name: /save/i })
    fireEvent.click(button)

    expect(mockOnNameSaved).toHaveBeenCalledWith('Alice')
  })

  it('persists trimmed name to localStorage on Save click', () => {
    render(<NamePromptDialog open={true} listId={listId} onNameSaved={mockOnNameSaved} />)

    const input = screen.getByPlaceholderText(/your name/i)
    fireEvent.change(input, { target: { value: 'Bob' } })

    const button = screen.getByRole('button', { name: /save/i })
    fireEvent.click(button)

    expect(localStorage.setItem).toHaveBeenCalledWith('our-cart-name-test-list-123', 'Bob')
  })

  it('disables Save button when input is empty or whitespace', () => {
    render(<NamePromptDialog open={true} listId={listId} onNameSaved={mockOnNameSaved} />)

    const button = screen.getByRole('button', { name: /save/i })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    const input = screen.getByPlaceholderText(/your name/i)
    fireEvent.change(input, { target: { value: '   ' } })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls onNameSaved when Enter is pressed in the input', () => {
    render(<NamePromptDialog open={true} listId={listId} onNameSaved={mockOnNameSaved} />)

    const input = screen.getByPlaceholderText(/your name/i)
    fireEvent.change(input, { target: { value: 'Carol' } })
    fireEvent.submit(input.closest('form')!)

    expect(mockOnNameSaved).toHaveBeenCalledWith('Carol')
    expect(localStorage.setItem).toHaveBeenCalledWith('our-cart-name-test-list-123', 'Carol')
  })
})
