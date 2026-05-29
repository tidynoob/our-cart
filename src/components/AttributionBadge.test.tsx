import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AttributionBadge } from './AttributionBadge'

describe('AttributionBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders initials when no avatarUrl (PROF-02 fallback)', () => {
    const { container } = render(<AttributionBadge name="Alice" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    // getInitials('Alice') returns 'A'
    expect(screen.getByText('A')).toBeTruthy()
  })

  it('renders img with referrerPolicy="no-referrer" when avatarUrl present (PROF-02)', () => {
    // RED until Wave 2 adds avatarUrl prop to AttributionBadge
    const { container } = render(
      <AttributionBadge name="Alice" avatarUrl="https://example.com/avatar.jpg" />
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('falls back to initials when img fires onError (PROF-02)', () => {
    // RED until Wave 2 adds avatarUrl prop to AttributionBadge
    const { container } = render(
      <AttributionBadge name="Alice" avatarUrl="https://bad.url" />
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('wrapper has aria-label "{name} added this"', () => {
    render(<AttributionBadge name="Bob" />)
    expect(screen.getByLabelText('Bob added this')).toBeTruthy()
  })

  it('does NOT render img when avatarUrl is undefined', () => {
    const { container } = render(<AttributionBadge name="Carol" />)
    expect(container.querySelector('img')).toBeNull()
  })
})
