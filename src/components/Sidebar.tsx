import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { Link, useMatch } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { List } from '@/types/list'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: List[]
  finalFocus?: React.RefObject<HTMLButtonElement>
}

export default function Sidebar({ open, onOpenChange, lists, finalFocus }: SidebarProps) {
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
          <div data-slot="profile-slot" className="mt-auto border-t border-sidebar-border p-4" />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
