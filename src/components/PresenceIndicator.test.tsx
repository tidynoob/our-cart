import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
// Import from a module that does NOT exist yet — this WILL fail RED at module
// resolution until Wave 1 (plan 12-02) creates src/components/PresenceIndicator.tsx
// (and its @/stores/presenceStore dependency). That import failure IS the
// intended Wave 0 state.
import { PresenceIndicator } from './PresenceIndicator'
import { usePresenceStore } from '@/stores/presenceStore'
import { useProfilesStore } from '@/stores/profilesStore'

// AttributionBadge is rendered for REAL (not mocked) — exactly as in
// AttributionBadge.test.tsx. The real badge still carries its hardcoded
// aria-label="{name} added this" on its inner <div>; the negative assertion
// below forces PresenceIndicator to neutralize that stale inner label so the
// wrapper "{name} is viewing this list" is the SINGLE accessible-name source.

beforeEach(() => {
  usePresenceStore.setState({ others: [], channel: null })
  useProfilesStore.setState({ profiles: {}, channel: null })
})

describe('PresenceIndicator — renders one badge per other user', () => {
  it('renders a badge reachable via the "{name} is viewing this list" label', () => {
    useProfilesStore.setState({
      profiles: { 'user-bob': { display_name: 'Bob', avatar_url: null } },
      channel: null,
    })
    usePresenceStore.setState({ others: [{ user_id: 'user-bob' }], channel: null })

    render(<PresenceIndicator />)

    expect(screen.getByLabelText('Bob is viewing this list')).toBeTruthy()
  })

  it('neutralizes the stale inner AttributionBadge label ("{name} added this")', () => {
    useProfilesStore.setState({
      profiles: { 'user-bob': { display_name: 'Bob', avatar_url: null } },
      channel: null,
    })
    usePresenceStore.setState({ others: [{ user_id: 'user-bob' }], channel: null })

    render(<PresenceIndicator />)

    // W-2 correctness pin: the wrapper label is the only accessible name.
    expect(screen.getByLabelText('Bob is viewing this list')).toBeTruthy()
    // The inner badge's hardcoded "Bob added this" MUST NOT be exposed.
    expect(screen.queryByLabelText('Bob added this')).toBeNull()
  })
})

describe('PresenceIndicator — empty state renders nothing', () => {
  it('returns null when there are no other users', () => {
    usePresenceStore.setState({ others: [], channel: null })

    const { container } = render(<PresenceIndicator />)

    expect(container.firstChild).toBeNull()
  })
})

describe('PresenceIndicator — member-set filter (anti-flooding)', () => {
  it('drops an unknown presence key absent from profiles (renders nothing)', () => {
    // Presence key has no matching profile => not a known list member.
    usePresenceStore.setState({ others: [{ user_id: 'ghost' }], channel: null })
    useProfilesStore.setState({ profiles: {}, channel: null })

    const { container } = render(<PresenceIndicator />)

    expect(container.firstChild).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders only the known member when others contains a known + an unknown key', () => {
    useProfilesStore.setState({
      profiles: { 'user-bob': { display_name: 'Bob', avatar_url: null } },
      channel: null,
    })
    usePresenceStore.setState({
      others: [{ user_id: 'user-bob' }, { user_id: 'ghost' }],
      channel: null,
    })

    render(<PresenceIndicator />)

    expect(screen.getByLabelText('Bob is viewing this list')).toBeTruthy()
    expect(screen.queryByLabelText('Unknown is viewing this list')).toBeNull()
  })
})

describe('PresenceIndicator — render-by-key dedupe', () => {
  it('renders exactly one badge for a single other user_id', () => {
    useProfilesStore.setState({
      profiles: { 'user-bob': { display_name: 'Bob', avatar_url: null } },
      channel: null,
    })
    usePresenceStore.setState({ others: [{ user_id: 'user-bob' }], channel: null })

    const { container } = render(<PresenceIndicator />)

    expect(container.querySelectorAll('[aria-label="Bob is viewing this list"]')).toHaveLength(1)
  })
})
