import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  it('renders h1 with text "Our Cart"', () => {
    render(<LoginPage onSignIn={vi.fn()} />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Our Cart')
  })

  it('renders subtitle text "Your shared grocery list"', () => {
    render(<LoginPage onSignIn={vi.fn()} />)
    expect(screen.getByText('Your shared grocery list')).toBeDefined()
  })

  it('renders a button with text "Sign in with Google"', () => {
    render(<LoginPage onSignIn={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeDefined()
  })

  it('calls onSignIn when button is clicked', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined)
    render(<LoginPage onSignIn={onSignIn} />)

    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    )

    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('does not display error when error prop is null', () => {
    render(<LoginPage onSignIn={vi.fn()} error={null} />)
    // No element with destructive class should exist
    const errorEl = document.querySelector('.text-destructive')
    expect(errorEl).toBeNull()
  })

  it('displays error message when error prop is provided', () => {
    render(<LoginPage onSignIn={vi.fn()} error="OAuth failed" />)
    expect(screen.getByText('OAuth failed')).toBeDefined()
  })
})
