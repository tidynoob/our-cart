import { describe, it, expect } from 'vitest'
// Import from module that does not exist yet — will fail RED until Wave 5 creates it
import { resolveDisplayName, resolveProfileName } from '@/lib/displayName'

// Minimal User-like shape for testing (mirrors Supabase Auth User)
interface TestUser {
  user_metadata?: {
    display_name?: string | null
    full_name?: string | null
    name?: string | null
  }
  email?: string | null
}

describe('resolveDisplayName — priority chain (HARD-02)', () => {
  it('returns display_name when present', () => {
    const user: TestUser = {
      user_metadata: { display_name: 'Alice Display', full_name: 'Alice Full', name: 'alice' },
      email: 'alice@example.com',
    }
    expect(resolveDisplayName(user as never)).toBe('Alice Display')
  })

  it('falls back to full_name when display_name is null', () => {
    const user: TestUser = {
      user_metadata: { display_name: null, full_name: 'Alice Full', name: 'alice' },
      email: 'alice@example.com',
    }
    expect(resolveDisplayName(user as never)).toBe('Alice Full')
  })

  it('falls back to name when display_name and full_name are null', () => {
    const user: TestUser = {
      user_metadata: { display_name: null, full_name: null, name: 'alice' },
      email: 'alice@example.com',
    }
    expect(resolveDisplayName(user as never)).toBe('alice')
  })

  it('falls back to email prefix when metadata names are all null', () => {
    const user: TestUser = {
      user_metadata: { display_name: null, full_name: null, name: null },
      email: 'alice@example.com',
    }
    expect(resolveDisplayName(user as never)).toBe('alice')
  })

  it('returns "Unknown" when all fields are null/undefined', () => {
    const user: TestUser = {
      user_metadata: {},
      email: null,
    }
    expect(resolveDisplayName(user as never)).toBe('Unknown')
  })

  it('returns "Unknown" when user_metadata is undefined and email is null', () => {
    const user: TestUser = { email: null }
    expect(resolveDisplayName(user as never)).toBe('Unknown')
  })
})

describe('resolveProfileName — profile row resolution (HARD-02)', () => {
  it('returns display_name when profile has it', () => {
    const profile = { display_name: 'Alice Display' }
    expect(resolveProfileName(profile)).toBe('Alice Display')
  })

  it('returns "Unknown" when profile is undefined', () => {
    expect(resolveProfileName(undefined)).toBe('Unknown')
  })

  it('returns "Unknown" when display_name is null', () => {
    const profile = { display_name: null }
    expect(resolveProfileName(profile)).toBe('Unknown')
  })
})
