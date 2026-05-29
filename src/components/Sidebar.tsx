import { useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon, Pencil } from 'lucide-react'
import { Link, useMatch } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'
import type { List } from '@/types/list'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: List[]
  user: User | null
  finalFocus?: React.RefObject<HTMLButtonElement>
}

function resolveDisplayName(user: User): string {
  return (
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'
  )
}

interface ProfileSectionProps {
  user: User
  onOpenChange: (open: boolean) => void
}

function ProfileSection({ user, onOpenChange }: ProfileSectionProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [avatarError, setAvatarError] = useState(false)
  const authError = useAuthStore((state) => state.error)

  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null
  const resolvedDisplayName = resolveDisplayName(user)

  function handleEditOpen() {
    setEditName(resolvedDisplayName)
    setEditOpen(true)
  }

  async function handleSave() {
    await useAuthStore.getState().updateDisplayName(editName)
    const currentError = useAuthStore.getState().error
    if (!currentError) {
      setEditOpen(false)
    }
  }

  async function handleSignOut() {
    onOpenChange(false)
    await useAuthStore.getState().signOut()
  }

  return (
    <>
      {editOpen ? (
        <div className="flex items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setEditOpen(false)
            }}
            aria-label="Display name"
            autoFocus
            className="h-8 text-sm flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!editName.trim()}
            onClick={handleSave}
          >
            Save name
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-2 min-h-[44px]">
          {avatarUrl && !avatarError ? (
            <img
              src={avatarUrl}
              alt={resolvedDisplayName}
              className="h-10 w-10 rounded-full object-cover shrink-0"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0 text-muted-foreground">
              {resolvedDisplayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex-1 truncate text-sm text-sidebar-foreground">
              {resolvedDisplayName}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit display name"
              onClick={handleEditOpen}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {authError && editOpen && (
        <p className="text-xs text-destructive mt-1">Could not save name. Try again.</p>
      )}
      <Button
        variant="ghost"
        className="mt-2 w-full min-h-[44px] justify-start text-sm text-destructive"
        onClick={handleSignOut}
        aria-label="Sign out"
      >
        Sign out
      </Button>
    </>
  )
}

export default function Sidebar({ open, onOpenChange, lists, user, finalFocus }: SidebarProps) {
  const match = useMatch('/list/:code')
  const activeCode = match?.params.code ?? null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-xs duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          finalFocus={finalFocus}
          className={cn(
            'fixed inset-y-0 left-0 z-50',
            'h-dvh',
            'w-72 max-w-[80vw]',
            'bg-sidebar text-sidebar-foreground flex flex-col',
            'shadow-lg ring-1 ring-foreground/10',
            'duration-200',
            'data-open:animate-in data-open:slide-in-from-left',
            'data-closed:animate-out data-closed:slide-out-to-left',
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <DialogPrimitive.Title className="font-heading text-base font-semibold leading-none">
              Your Lists
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close navigation"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {lists.length === 0 ? (
              <p className="px-4 py-3 text-sm font-normal text-muted-foreground">No lists yet</p>
            ) : (
              lists.map((list) => {
                const isActive = list.share_code === activeCode
                return (
                  <Link
                    key={list.id}
                    to={`/list/${list.share_code}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'flex items-center min-h-[48px] px-4 py-3 text-sm truncate transition-colors',
                      'font-normal text-sidebar-foreground hover:bg-sidebar-accent',
                      isActive && 'bg-sidebar-accent font-semibold',
                    )}
                  >
                    {list.name}
                  </Link>
                )
              })
            )}
          </nav>

          {/* Phase 9: profile section (avatar / name / sign-out) mounts here — PROF-01/02/03 */}
          <div data-slot="profile-slot" className="mt-auto border-t border-sidebar-border p-4">
            {user && <ProfileSection user={user} onOpenChange={onOpenChange} />}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
