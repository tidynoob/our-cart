import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutocompleteSuggestions } from './AutocompleteSuggestions'

describe('AutocompleteSuggestions', () => {
  const mockOnSelect = vi.fn()
  const suggestions = [
    { name: 'Milk', category: 'Dairy', quantity: '2' },
    { name: 'Bread', category: 'Bakery', quantity: null },
    { name: 'Eggs', category: null, quantity: '12' },
  ]

  it('renders a listbox with option roles', () => {
    render(
      <AutocompleteSuggestions
        suggestions={suggestions}
        focusedIndex={-1}
        onSelect={mockOnSelect}
      />
    )

    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeDefined()
    expect(listbox.getAttribute('id')).toBe('autocomplete-listbox')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
  })

  it('displays item name and category when category is set', () => {
    render(
      <AutocompleteSuggestions
        suggestions={suggestions}
        focusedIndex={-1}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('Milk')).toBeDefined()
    expect(screen.getByText('Dairy')).toBeDefined()
    expect(screen.getByText('Bread')).toBeDefined()
    expect(screen.getByText('Bakery')).toBeDefined()
    // Eggs has no category — should not show category text
    expect(screen.getByText('Eggs')).toBeDefined()
  })

  it('applies aria-selected to the focused option', () => {
    render(
      <AutocompleteSuggestions
        suggestions={suggestions}
        focusedIndex={1}
        onSelect={mockOnSelect}
      />
    )

    const options = screen.getAllByRole('option')
    expect(options[0].getAttribute('aria-selected')).toBe('false')
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('false')
  })

  it('calls onSelect when an option is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AutocompleteSuggestions
        suggestions={suggestions}
        focusedIndex={-1}
        onSelect={mockOnSelect}
      />
    )

    await user.click(screen.getByText('Bread'))
    expect(mockOnSelect).toHaveBeenCalledWith({
      name: 'Bread',
      category: 'Bakery',
      quantity: null,
    })
  })

  it('has onMouseDown preventDefault on each option to prevent blur', () => {
    render(
      <AutocompleteSuggestions
        suggestions={suggestions}
        focusedIndex={-1}
        onSelect={mockOnSelect}
      />
    )

    const options = screen.getAllByRole('option')
    // Verify each option has the onMouseDown handler by triggering mousedown
    // and checking that default was prevented
    options.forEach((option) => {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      const prevented = !option.dispatchEvent(event)
      expect(prevented).toBe(true)
    })
  })
})
