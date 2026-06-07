import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
// Import from module that does not exist yet — will fail RED until Wave 5 creates it
import { Spinner } from '@/components/Spinner'

describe('Spinner — accessibility contract (HARD-02)', () => {
  it('renders with role="status"', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders with aria-label matching default label "Loading"', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-label')).toBe('Loading')
  })

  it('renders with aria-label matching custom label prop', () => {
    render(<Spinner label="Saving" />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-label')).toBe('Saving')
  })

  it('renders label text with "..." appended', () => {
    render(<Spinner label="Loading" />)
    expect(screen.getByText('Loading...')).toBeTruthy()
  })

  it('size="sm" applies text-sm class to the label span', () => {
    const { container } = render(<Spinner label="Loading" size="sm" />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.className).toContain('text-sm')
  })
})
