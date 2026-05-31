import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useProfilesStore } from '@/stores/profilesStore'
import { AttributionBadge } from '@/components/AttributionBadge'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'

interface MemberEntry {
  user_id: string
  joined_at?: string
}

interface MembersDialogProps {
  listId: string
  listName: string
  ownerId: string
  /** Pre-fetched member list from the parent (list_members rows). */
  members?: MemberEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Member management dialog.
 *
 * - Renders the current list members with AttributionBadge + display name.
 * - Owner sees a destructive "Remove member" button on each non-self member row.
 * - Non-owner sees a destructive "Leave list" button on their own row.
 * - Remove confirm: calls remove_member RPC. Failure shows inline dismissible error.
 * - Leave confirm: optimistic navigate('/'), then calls leave_list RPC.
 *   Failure shows inline dismissible error.
 *
 * Dialog uses disablePointerDismissal + showCloseButton={false} per existing
 * ListPage.tsx Dialog conventions (prevent accidental mobile backdrop dismiss).
 */
export default function MembersDialog({
  listId,
  listName,
  ownerId,
  members,
  open,
  onOpenChange,
}: MembersDialogProps) {
  const navigate = useNavigate()
  // Use whole-state form so vi.fn().mockReturnValue({user,profiles}) works in tests.
  // Zustand supports calling without selector — returns entire state snapshot.
  const { user: currentUser } = useAuthStore()
  const { profiles } = useProfilesStore()

  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [targetMember, setTargetMember] = useState<{
    user_id: string
    display_name: string
  } | null>(null)
  const [rpcError, setRpcError] = useState<string | null>(null)
  const [rpcLoading, setRpcLoading] = useState(false)

  const isOwner = Boolean(currentUser && currentUser.id === ownerId)

  function openRemoveConfirm(member: MemberEntry) {
    const profile = profiles[member.user_id]
    setTargetMember({
      user_id: member.user_id,
      display_name: profile?.display_name ?? 'Unknown',
    })
    setRpcError(null)
    setRemoveConfirmOpen(true)
  }

  function openLeaveConfirm() {
    setRpcError(null)
    setLeaveConfirmOpen(true)
  }

  async function handleRemoveConfirm() {
    if (!targetMember) return
    setRpcLoading(true)
    setRpcError(null)
    const { error } = await supabase.rpc('remove_member', {
      p_list_id: listId,
      p_user_id: targetMember.user_id,
    })
    setRpcLoading(false)
    if (error) {
      setRpcError("Couldn't remove member. Try again.")
    } else {
      setRemoveConfirmOpen(false)
      setTargetMember(null)
    }
  }

  async function handleLeaveConfirm() {
    // Optimistic navigation — navigate before RPC resolves (D-09)
    navigate('/')
    const { error } = await supabase.rpc('leave_list', {
      p_list_id: listId,
    })
    if (error) {
      setRpcError("Couldn't leave the list. Try again.")
    }
  }

  // Members may be loading (undefined) or empty
  const membersLoading = members === undefined
  const memberList = members ?? []

  return (
    <>
      {/* Main members dialog */}
      <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Members</DialogTitle>
          </DialogHeader>

          {membersLoading ? (
            <Spinner label="Loading members" size="sm" className="py-4" />
          ) : (
            <div>
              {memberList.map((member) => {
                const profile = profiles[member.user_id]
                const displayNameText = profile?.display_name ?? 'Unknown'
                const avatarUrl = profile?.avatar_url ?? undefined
                const isSelf = member.user_id === currentUser?.id

                return (
                  <div
                    key={member.user_id}
                    className="flex min-h-[44px] items-center gap-3 py-2 border-b border-border"
                  >
                    <AttributionBadge
                      name={displayNameText}
                      avatarUrl={avatarUrl}
                    />
                    <span className="flex-1 text-base">
                      {displayNameText}
                      {isSelf && (
                        <span className="text-muted-foreground text-sm ml-1">
                          (you)
                        </span>
                      )}
                    </span>

                    {/* Owner: remove button for non-self members (hidden when confirm dialog is open to avoid DOM ambiguity) */}
                    {isOwner && !isSelf && !removeConfirmOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => openRemoveConfirm(member)}
                      >
                        Remove member
                      </Button>
                    )}

                    {/* Non-owner: leave button for self (hidden when confirm dialog is open) */}
                    {!isOwner && isSelf && !leaveConfirmOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => openLeaveConfirm()}
                      >
                        Leave list
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member confirm dialog — only mounted when needed */}
      {removeConfirmOpen && (
        <Dialog
          open={removeConfirmOpen}
          onOpenChange={(open) => {
            if (!rpcLoading) setRemoveConfirmOpen(open)
          }}
          disablePointerDismissal
        >
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Remove {targetMember?.display_name}?</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              They'll lose access to this list immediately.
            </DialogDescription>
            {rpcError && (
              <div role="alert" className="text-sm text-destructive px-1 pb-2">
                {rpcError}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRemoveConfirmOpen(false)
                  setRpcError(null)
                }}
                disabled={rpcLoading}
              >
                Keep member
              </Button>
              <Button
                variant="destructive"
                disabled={rpcLoading}
                onClick={handleRemoveConfirm}
              >
                Remove member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Leave list confirm dialog — only mounted when needed */}
      {leaveConfirmOpen && (
        <Dialog
          open={leaveConfirmOpen}
          onOpenChange={(open) => {
            if (!rpcLoading) setLeaveConfirmOpen(open)
          }}
          disablePointerDismissal
        >
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Leave '{listName}'?</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              You'll lose access to this list.
            </DialogDescription>
            {rpcError && (
              <div role="alert" className="text-sm text-destructive px-1 pb-2">
                {rpcError}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setLeaveConfirmOpen(false)
                  setRpcError(null)
                }}
                disabled={rpcLoading}
              >
                Stay on list
              </Button>
              <Button
                variant="destructive"
                disabled={rpcLoading}
                onClick={handleLeaveConfirm}
              >
                Leave list
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
