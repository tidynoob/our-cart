import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Menu, Pencil, Share2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import { useItemsStore } from '@/stores/itemsStore'
import { useListsStore } from '@/stores/listsStore'
import { useAuthStore } from '@/stores/authStore'
import { groupItemsByCategory } from '@/lib/categories'
import type { Item } from '@/types/item'
import type { User } from '@supabase/supabase-js'
import { ShareBanner } from '@/components/ShareBanner'
import { AddItemBar } from '@/components/AddItemBar'
import { CategorySection } from '@/components/CategorySection'
import { SyncStatus } from '@/components/SyncStatus'
import { useSidebarContext } from '@/contexts/SidebarContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface List {
  id: string
  name: string
  share_code: string
  owner_id: string
  created_at: string
}

export default function ListPage() {
  const { onOpenSidebar, triggerRef } = useSidebarContext()
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const dismissedBanners = useUIStore((state) => state.dismissedBanners)
  const dismissBanner = useUIStore((state) => state.dismissBanner)
  const restoreBanner = useUIStore((state) => state.restoreBanner)
  const [list, setList] = useState<List | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit/delete state managed locally in ListPage (not Zustand)
  // Per review: these are ephemeral UI state for this page only
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  // Clear dialog state — ephemeral UI, not Zustand
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  // List rename state — ephemeral UI, not Zustand
  const [listRenameOpen, setListRenameOpen] = useState(false)
  const [listRenameName, setListRenameName] = useState('')

  // Delete list dialog state — ephemeral UI, not Zustand
  const [deleteListDialogOpen, setDeleteListDialogOpen] = useState(false)
  const [deleteListLoading, setDeleteListLoading] = useState(false)

  // Auth state — for owner guard (user.id === list.owner_id)
  const user = useAuthStore((state) => state.user)

  // Lists store — live name cache (D-06 Pitfall 5 fix) + mutation actions
  const storedLists = useListsStore((state) => state.lists)
  const renameList = useListsStore((state) => state.renameList)
  const deleteList = useListsStore((state) => state.deleteList)

  const items = useItemsStore((state) => state.items)
  const itemsLoading = useItemsStore((state) => state.loading)
  const itemsError = useItemsStore((state) => state.error)
  const fetchItems = useItemsStore((state) => state.fetchItems)
  const updateItem = useItemsStore((state) => state.updateItem)
  const deleteItem = useItemsStore((state) => state.deleteItem)
  const toggleChecked = useItemsStore((state) => state.toggleChecked)
  const clearChecked = useItemsStore((state) => state.clearChecked)

  // Derived from store — no new state field (per research: items.filter(i => i.checked).length)
  const checkedCount = items.filter((i) => i.checked).length

  // D-06 Pitfall 5 fix: derive live name from listsStore cache when available.
  // Falls back to local list state so direct-URL navigation (D-03) still works.
  const storedName = storedLists.find((l) => l.id === list?.id)?.name
  const displayName = storedName ?? list?.name

  // Owner guard — hides rename/delete affordances for non-owners and legacy NULL lists
  const isOwner = Boolean(user && list && user.id === list.owner_id)

  // Lifecycle step 1: Fetch list by share code
  useEffect(() => {
    if (!code) {
      navigate('/')
      return
    }

    async function fetchList() {
      const { data, error: supabaseError } = await supabase
        .from('lists')
        .select('id, name, share_code, owner_id, created_at')
        .eq('share_code', code)
        .single()

      if (supabaseError || !data) {
        setError('List not found')
      } else {
        setList(data)
      }
      setLoading(false)
    }

    fetchList()
  }, [code, navigate])

  // Lifecycle step 2: Once list is loaded, subscribe-before-fetch (D-05) + reconnect listeners (D-07)
  // WR-04 fix: Access action functions via getState() inside the effect body and cleanup
  // to avoid including them in the dependency array. This prevents potential re-subscribe
  // loops if a future refactor causes Zustand action references to change.
  useEffect(() => {
    if (!list) return

    // D-05: subscribe before fetch — store's subscribeToList opens channel,
    // then calls fetchItems internally on SUBSCRIBED (D-06). No separate fetchItems() call here.
    const { subscribeToList: subscribe } = useItemsStore.getState()
    subscribe(list.id)

    // D-07: belt-and-suspenders for mobile Safari screen-lock reconnect.
    // WR-02 fix: Route through subscribeToList (the full recovery path) instead of
    // calling fetchItems directly. This consolidates recovery into a single path and
    // leverages the existing inFlightListId dedup guard, preventing concurrent
    // unguarded fetches when visibilitychange + online fire in rapid succession.
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        useItemsStore.getState().subscribeToList(list!.id)
      }
    }
    // SYNC-03: Immediate network-loss detection via browser 'offline' event.
    // Sets syncStatus to 'reconnecting' without waiting for the 25-50s WebSocket heartbeat timeout.
    function handleOffline() {
      useItemsStore.setState({ syncStatus: 'reconnecting' })
    }
    // SYNC-03: On network restore, set 'connecting' then re-subscribe (which internally
    // transitions to 'live' on SUBSCRIBED and fetches items). Replaces the prior bare
    // fetchItems call — re-subscribing is the full recovery path.
    function handleOnline() {
      useItemsStore.setState({ syncStatus: 'connecting' })
      useItemsStore.getState().subscribeToList(list!.id)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      useItemsStore.getState().unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [list]) // Only re-run when the list identity changes

  // --- Edit/Delete Handlers ---

  /** Tap an item to enter edit mode. Switches to new item if another is being edited. */
  function handleItemTap(id: string) {
    if (editingItemId === id) return
    setEditingItemId(id)
    setDeletingItemId(null)
  }

  /** Exit edit mode without saving (also clears delete state). */
  function handleCancelEdit() {
    setEditingItemId(null)
    setDeletingItemId(null)
  }

  /** Save edited item changes via store action, then exit edit mode. */
  function handleSave(id: string, changes: Partial<Pick<Item, 'name' | 'quantity' | 'category'>>) {
    // Store handles rollback + error state internally; .catch() guards
    // against unhandled rejections from network-level throws (WR-03).
    updateItem(id, changes).catch(() => {})
    setEditingItemId(null)
    setDeletingItemId(null)
  }

  /** Show delete confirmation for the currently editing item. */
  function handleDelete(id: string) {
    setDeletingItemId(id)
  }

  /** Actually delete the item via store action and exit edit/delete mode. */
  function handleConfirmDelete(id: string) {
    // Store handles rollback + error state internally; .catch() guards
    // against unhandled rejections from network-level throws (WR-03).
    deleteItem(id).catch(() => {})
    setEditingItemId(null)
    setDeletingItemId(null)
  }

  /** Cancel delete confirmation — go back to edit mode (clear deletingItemId only). */
  function handleCancelDelete() {
    setDeletingItemId(null)
  }

  // --- Toggle Handler (Phase 3 — SHOP-01/02) ---

  /** Toggle checked state on an item — optimistic update via store. */
  function handleToggle(id: string) {
    // Store handles rollback + error state internally; .catch() guards
    // against unhandled rejections from network-level throws (WR-03).
    toggleChecked(id).catch(() => {})
  }

  // --- Clear Checked Handler (Phase 3 — SHOP-03/04) ---

  /** Close dialog and bulk-delete all checked items optimistically via store. */
  function handleClearConfirm() {
    setClearDialogOpen(false)
    // Store handles optimistic remove, rollback, and error state internally (SHOP-03).
    clearChecked(list!.id).catch(() => {})
  }

  // --- List Rename Handlers (D-06) ---

  /** Enter rename mode and seed the input with the current name. */
  function handleRenameOpen() {
    setListRenameOpen(true)
    setListRenameName(displayName ?? '')
  }

  /** Cancel rename — exit inline edit mode without saving. */
  function cancelListRename() {
    setListRenameOpen(false)
  }

  /** Save the new list name via store (optimistic update). */
  async function handleListRename() {
    if (!listRenameName.trim()) return
    await renameList(list!.id, listRenameName.trim())
    setListRenameOpen(false)
  }

  // --- List Delete Handlers (D-08) ---

  /** Confirm delete: await store action then navigate away so deleted URL is unreachable. */
  async function handleListDeleteConfirm() {
    setDeleteListLoading(true)
    // Pitfall 3: navigate only after DB confirms — store optimistic remove already happened.
    await deleteList(list!.id)
    setDeleteListLoading(false)
    navigate('/')
  }

  /** Resolve a display name from auth user metadata — D-10 / Pitfall 4 / Pitfall 8. */
  function resolveDisplayName(u: User): string {
    return (
      u.user_metadata?.display_name ??
      u.user_metadata?.full_name ??
      u.user_metadata?.name ??
      u.email?.split('@')[0] ??
      'Unknown'
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p>Loading...</p>
      </div>
    )
  }

  if (error || !list) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p>List not found</p>
        <Link to="/" className="text-blue-600 underline mt-2">
          Back to home
        </Link>
      </div>
    )
  }

  const grouped = groupItemsByCategory(items)

  // Current-user attribution values for CategorySection → ItemRow live attribution (D-04/D-06)
  const currentUserDisplayName = user ? resolveDisplayName(user) : undefined
  const currentUserAvatarUrl = user
    ? (user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null)
    : null

  return (
    <div className="min-h-screen flex flex-col items-center">
      {/* ShareBanner shown until dismissed (D-04) */}
      {!dismissedBanners.has(list.share_code) && (
        <ShareBanner
          listCode={list.share_code}
          listName={displayName ?? list.name}
          onDismiss={() => dismissBanner(list.share_code)}
        />
      )}

      <div className="w-full max-w-md p-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={onOpenSidebar}
            className="h-8 w-8 shrink-0"
          >
            <Menu className="h-4 w-4" />
          </Button>
          {/* Header: inline rename input (owner only) or list name + controls */}
          {isOwner && listRenameOpen ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input
                value={listRenameName}
                onChange={(e) => setListRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleListRename()
                  if (e.key === 'Escape') cancelListRename()
                }}
                aria-label="Rename list"
                autoFocus
                className="h-8 text-sm flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleListRename}>
                Save name
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelListRename}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h1 className="text-2xl font-semibold truncate">{displayName}</h1>
              {isOwner && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Rename ${displayName}`}
                    onClick={handleRenameOpen}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${displayName}`}
                    onClick={() => setDeleteListDialogOpen(true)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
          <SyncStatus />
          {dismissedBanners.has(list.share_code) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Show share code"
              onClick={() => restoreBanner(list.share_code)}
              className="h-8 w-8 shrink-0"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-6">
          {/* Add item bar — always active for authenticated users (D-10).
              addedBy comes from auth display name via resolveDisplayName(). */}
          <AddItemBar
            listId={list.id}
            addedBy={resolveDisplayName(user!)}
          />

          {/* Items loading state */}
          {itemsLoading && (
            <p className="text-sm text-muted-foreground">Loading items...</p>
          )}

          {/* Items error state — covers both load failures and failed
              optimistic mutations (add/update/delete/toggle/clear). The store sets a
              specific message; Retry re-fetches to recover the canonical
              server state (CR-02). */}
          {itemsError && (
            <div className="text-sm">
              <p className="text-red-600" role="alert">{itemsError}</p>
              <button
                type="button"
                onClick={() => fetchItems(list.id)}
                className="text-blue-600 underline mt-1"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!itemsLoading && !itemsError && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <h2 className="text-lg font-semibold">Your list is empty</h2>
              <p className="text-sm text-muted-foreground">Add your first item above</p>
            </div>
          )}

          {/* Category sections */}
          {!itemsLoading && grouped.map((group) => (
            <CategorySection
              key={group.category}
              category={group.category}
              items={group.items}
              editingItemId={editingItemId}
              deletingItemId={deletingItemId}
              onItemTap={handleItemTap}
              onCancelEdit={handleCancelEdit}
              onSave={handleSave}
              onDelete={handleDelete}
              onConfirmDelete={handleConfirmDelete}
              onCancelDelete={handleCancelDelete}
              onToggle={handleToggle}
              currentUserId={user?.id ?? null}
              currentUserDisplayName={currentUserDisplayName}
              currentUserAvatarUrl={currentUserAvatarUrl}
            />
          ))}

          {/* Clear completed button — only rendered when checked items exist (D-06) */}
          {!itemsLoading && checkedCount > 0 && (
            <div className="px-4">
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setClearDialogOpen(true)}
              >
                Clear completed ({checkedCount})
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Clear confirmation dialog (D-07) — disablePointerDismissal prevents
          accidental backdrop tap on mobile while shopping (RESEARCH Pitfall 5) */}
      <Dialog
        open={clearDialogOpen}
        onOpenChange={(open) => setClearDialogOpen(open)}
        disablePointerDismissal
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Remove {checkedCount} checked item{checkedCount !== 1 ? 's' : ''}?
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Keep Items
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearConfirm}
            >
              Clear Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete list confirmation dialog (D-08) — disablePointerDismissal prevents
          accidental backdrop tap on mobile; navigate('/') after success. */}
      <Dialog
        open={deleteListDialogOpen}
        onOpenChange={(open) => { if (!open && !deleteListLoading) setDeleteListDialogOpen(false) }}
        disablePointerDismissal
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete '{displayName}'?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            This removes the list and all its items permanently.
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleteListLoading}
              onClick={() => setDeleteListDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteListLoading}
              onClick={handleListDeleteConfirm}
            >
              {deleteListLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
