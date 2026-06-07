import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Import from module that does not exist yet — will fail RED until Wave 3 creates it
import MembersDialog from '@/components/MembersDialog'

// vi.hoisted — mock variables available inside vi.mock() factory
const { mockNavigate, mockRpc, mockUseAuthStore } = vi.hoisted(() => {
  const _mockNavigate = vi.fn()
  const _mockRpc = vi.fn().mockResolvedValue({ error: null })
  const _mockUseAuthStore = vi.fn().mockReturnValue({
    user: { id: 'owner-uid', email: 'owner@example.com' },
  })
  return { mockNavigate: _mockNavigate, mockRpc: _mockRpc, mockUseAuthStore: _mockUseAuthStore }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    }),
    removeChannel: vi.fn(),
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: mockUseAuthStore,
}))

vi.mock('@/stores/profilesStore', () => ({
  useProfilesStore: vi.fn().mockReturnValue({
    profiles: {
      'owner-uid': { display_name: 'Owner User', avatar_url: null },
      'member-uid': { display_name: 'Member User', avatar_url: null },
    },
  }),
}))

const defaultProps = {
  listId: 'list-1',
  listName: 'Test List',
  ownerId: 'owner-uid',
  members: [
    { user_id: 'owner-uid', joined_at: '2026-01-01T00:00:00Z' },
    { user_id: 'member-uid', joined_at: '2026-01-02T00:00:00Z' },
  ],
  open: true,
  onOpenChange: vi.fn(),
}

describe('MembersDialog — renders dialog (MEMBER-01, MEMBER-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ error: null })
    // Default: owner view
    mockUseAuthStore.mockReturnValue({ user: { id: 'owner-uid', email: 'owner@example.com' } })
  })

  it('renders "Members" dialog title when open=true', () => {
    render(<MembersDialog {...defaultProps} />)
    expect(screen.getByText('Members')).toBeTruthy()
  })
})

describe('MembersDialog — remove member (MEMBER-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ error: null })
    // Render as owner
    mockUseAuthStore.mockReturnValue({ user: { id: 'owner-uid', email: 'owner@example.com' } })
  })

  it('owner sees "Remove" button for other members', () => {
    render(<MembersDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: /remove/i })).toBeTruthy()
  })

  it('owner clicks Remove then confirms → supabase.rpc called with remove_member args', async () => {
    const user = userEvent.setup()
    render(<MembersDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm|yes|remove member/i })).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: /confirm|yes|remove member/i }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('remove_member', {
        p_list_id: 'list-1',
        p_user_id: 'member-uid',
      })
    })
  })
})

describe('MembersDialog — leave list (MEMBER-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ error: null })
    // Render as non-owner
    mockUseAuthStore.mockReturnValue({ user: { id: 'member-uid', email: 'member@example.com' } })
  })

  it('non-owner sees "Leave" button', () => {
    render(<MembersDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: /leave/i })).toBeTruthy()
  })

  it('non-owner clicks Leave then confirms → supabase.rpc called with leave_list and navigate("/")', async () => {
    const user = userEvent.setup()
    render(<MembersDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /leave/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm|yes|leave/i })).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: /confirm|yes|leave/i }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('leave_list', { p_list_id: 'list-1' })
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })
})
