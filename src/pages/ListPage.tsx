import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowDownToLine, Menu, Pencil, Share2, Trash2, Users } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import { useItemsStore } from '@/stores/itemsStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useProfilesStore } from '@/stores/profilesStore'
import { usePresenceStore } from '@/stores/presenceStore'
import { useListsStore } from '@/stores/listsStore'
import { useAuthStore } from '@/stores/authStore'
import { groupItemsByCategory } from '@/lib/categories'
import type { Item } from '@/types/item'
import { resolveDisplayName } from '@/lib/displayName'
import { ShareBanner } from '@/components/ShareBanner'
import { IosInstallBanner } from '@/components/IosInstallBanner'
import { InstallPrompt } from '@/components/InstallPrompt'
import { AddItemBar } from '@/components/AddItemBar'
import { UndoSnackbar } from '@/components/UndoSnackbar'
import { CategorySection } from '@/components/CategorySection'
import { SyncStatus } from '@/components/SyncStatus'
import { PresenceIndicator } from '@/components/PresenceIndicator'
import { Spinner } from '@/components/Spinner'
import MembersDialog from '@/components/MembersDialog'
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

  // Uncheck-all confirm dialog state (SHOP-06) — ephemeral UI, mirrors clearDialogOpen
  const [uncheckDialogOpen, setUncheckDialogOpen] = useState(false)

  // List rename state — ephemeral UI, not Zustand
  const [listRenameOpen, setListRenameOpen] = useState(false)
  const [listRenameName, setListRenameName] = useState('')

  // Delete list dialog state — ephemeral UI, not Zustand
  const [deleteListDialogOpen, setDeleteListDialogOpen] = useState(false)
  const [deleteListLoading, setDeleteListLoading] = useState(false)

  // Members dialog state — ephemeral UI, not Zustand
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)

  // List members state — fetched after list loads; undefined = loading spinner in dialog
  const [listMembers, setListMembers] = useState<
    { user_id: string; created_at: string }[] | undefined
  >(undefined)

  // Member removal eject state — set true when current user is removed from list
  const [removedFromList, setRemovedFromList] = useState(false)

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
  const uncheckAll = useItemsStore((state) => state.uncheckAll)
  const reorderItem = useItemsStore((state) => state.reorderItem)

  // QOL-02: checked-to-bottom sort preference (persisted localStorage 'our-cart-prefs').
  // Device-local, not synced to the partner. Fed into groupItemsByCategory below.
  const checkedToBottom = usePreferencesStore((state) => state.checkedToBottom)
  const toggleCheckedToBottom = usePreferencesStore((state) => state.toggleCheckedToBottom)

  // dnd-kit sensors (ITEM-02 / RESEARCH Pattern 1): PointerSensor with an 8px
  // activation distance so tap/scroll/swipe don't start a drag (Pitfall 4), plus
  // a KeyboardSensor for accessible pickup/move.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Derived from store — no new state field (per research: items.filter(i => i.checked).length)
  const checkedCount = items.filter((i) => i.checked).length
  // VIEW-01: total item count for the count badge (pure derive, zero new state — D-06)
  const totalCount = items.length

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

    // Load cross-user profiles for attribution (PROF-04) and subscribe to live updates (PROF-05)
    useProfilesStore.getState().loadForList(list.id)

    // Open the presence channel (OPS-02). Dedicated topic presence-${id}; key=user.id.
    // Identity is a presentational fallback only — PresenceIndicator renders from
    // the server-sourced profilesStore. track() fires on SUBSCRIBED inside the store.
    usePresenceStore.getState().subscribe(list.id, user!.id, {
      display_name: resolveDisplayName(user!),
      avatar_url:
        user!.user_metadata?.avatar_url ?? user!.user_metadata?.picture ?? null,
    })

    // Fetch list members so MembersDialog shows member rows (not spinner) (T3/T4 fix)
    fetchListMembers(list.id)

    // Open list-level Broadcast channel for member_removed eject (MEMBER-01 / D-09)
    // Topic 'list-{listId}' is distinct from 'items-{listId}' (RESEARCH Pattern 6)
    const listChannel = supabase
      .channel(`list-${list.id}`)
      .on('broadcast', { event: 'member_removed' }, (payload) => {
        // Only eject if the removed user_id matches the current user (T-11-06-01 spoofing guard)
        if (payload.payload?.user_id === user?.id) {
          setRemovedFromList(true)
          setTimeout(() => navigate('/'), 1500)
        }
      })
      .subscribe()

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
      useProfilesStore.getState().unsubscribe()  // clean up profiles channel (Pitfall 4)
      usePresenceStore.getState().unsubscribe()  // untrack + removeChannel presence (crit 2)
      supabase.removeChannel(listChannel)          // clean up list Broadcast channel (T-11-06-02)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      setListMembers(undefined)  // reset so dialog shows spinner on next list load
    }
  }, [list, user?.id, navigate]) // user?.id (not user) — token refresh mints a new user object with the same id; depending on the object tore down + rebuilt every channel hourly

  // --- Members Fetch ---

  /** Fetch list_members for the current list and populate listMembers state. */
  async function fetchListMembers(listId: string) {
    const { data } = await supabase
      .from('list_members')
      .select('user_id, created_at')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    setListMembers(data ?? [])
  }

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
  function handleSave(
    id: string,
    changes: Partial<Pick<Item, 'name' | 'quantity' | 'category' | 'note' | 'position'>>
  ) {
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

  // --- Drag-reorder Handler (ITEM-02 / RESEARCH Pattern 1) ---

  /** Drop end → reorder via store. Guards no-op drops; store owns the single
   *  {category, position} write + rollback. .catch() guards unhandled rejection. */
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    reorderItem(String(active.id), String(over.id)).catch(() => {})
  }

  // --- Quantity Stepper Handler (ITEM-03) ---

  /** Stepper tap → quantity-only optimistic update via store. */
  function handleStep(id: string, quantity: string) {
    updateItem(id, { quantity }).catch(() => {})
  }

  // --- Clear Checked Handler (Phase 3 — SHOP-03/04) ---

  /** Close dialog and bulk-delete all checked items optimistically via store. */
  function handleClearConfirm() {
    setClearDialogOpen(false)
    // Store handles optimistic remove, rollback, and error state internally (SHOP-03).
    // clearChecked now also populates lastCleared → the UndoSnackbar appears (SHOP-05).
    clearChecked(list!.id).catch(() => {})
  }

  // --- Uncheck All Handler (SHOP-06 / D-05) ---

  /** Close dialog and bulk-uncheck all checked items optimistically via store. */
  function handleUncheckConfirm() {
    setUncheckDialogOpen(false)
    // Store handles optimistic flip-all, rollback, and error state internally (SHOP-06).
    uncheckAll(list!.id).catch(() => {})
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
    // WR-06: guard the async mutation. Without try/catch a network throw from renameList
    // leaves the rename dialog stuck open (unhandled rejection). The store owns optimistic
    // update + rollback + error state; we only need to close the dialog once it settles
    // (success OR failure) so the UI never freezes. Mirrors the .catch(() => {}) pattern
    // used by every other mutation handler in this file.
    try {
      await renameList(list!.id, listRenameName.trim())
    } catch {
      // Store surfaces the error; just don't leave the dialog wedged.
    } finally {
      setListRenameOpen(false)
    }
  }

  // --- List Delete Handlers (D-08) ---

  /** Confirm delete: await store action then navigate away so deleted URL is unreachable. */
  async function handleListDeleteConfirm() {
    setDeleteListLoading(true)
    // WR-06: guard the async delete. On a throw the await rejects, so without try/catch
    // deleteListLoading is never reset and the dialog freezes on a permanent "Deleting…"
    // button (the navigate never runs either). Navigate ONLY on success so a half-failed
    // delete can't strand the user away from a list that still exists; on failure re-enable
    // the controls so the user can retry or cancel. The store surfaces the error.
    try {
      // Pitfall 3: navigate only after DB confirms — store optimistic remove already happened.
      await deleteList(list!.id)
      navigate('/')
    } catch {
      setDeleteListLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Spinner />
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

  const grouped = groupItemsByCategory(items, checkedToBottom)
  // Flat id list (grouped/sorted order) for the single list-wide SortableContext.
  const flatItemIds = grouped.flatMap((g) => g.items.map((i) => i.id))

  return (
    <div className="min-h-screen flex flex-col items-center">
      {/* iOS A2HS instruction banner (PWA-01 / D-11) — top banner position like
          ShareBanner. Self-gates (isIosSafari && !standalone && !dismissed), so
          no dismissedBanners wrapper; its own predicate owns visibility. */}
      <IosInstallBanner />

      {/* ShareBanner shown until dismissed (D-04) */}
      {!dismissedBanners.has(list.share_code) && (
        <ShareBanner
          listCode={list.share_code}
          listName={displayName ?? list.name}
          onDismiss={() => dismissBanner(list.share_code)}
        />
      )}

      {/* Member removal eject message (MEMBER-01 / D-09) — shown before redirect to '/' */}
      {removedFromList && (
        <div
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground text-center py-2"
        >
          You were removed from this list
        </div>
      )}

      <div className="w-full max-w-md p-4">
        <div className="flex items-center justify-between gap-1">
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
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold truncate">{displayName}</h1>
                {/* VIEW-01: live count badge under the title (UI-SPEC §3) — hidden when empty */}
                {totalCount > 0 && (
                  <span
                    className="text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {checkedCount} / {totalCount} checked
                  </span>
                )}
              </div>
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
          {/* Presence (OPS-02) — between the name block and SyncStatus; self never shown */}
          <PresenceIndicator />
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
          {/* Checked-to-bottom toggle (QOL-02 / D-11) — persistent icon Button (not a
              shadcn Switch); accent when ON. Reads/writes usePreferencesStore. */}
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={checkedToBottom}
            aria-label={
              checkedToBottom
                ? 'Stop sorting checked items to bottom'
                : 'Sort checked items to bottom'
            }
            onClick={toggleCheckedToBottom}
            className={`h-8 w-8 shrink-0 ${checkedToBottom ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
          {/* Members management button (D-07) — visible to all authenticated list members */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Manage members"
            onClick={() => setMembersDialogOpen(true)}
            className="h-8 w-8 shrink-0"
          >
            <Users className="h-4 w-4" />
          </Button>
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
            <Spinner label="Loading items" size="sm" />
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

          {/* Category sections — single list-wide DndContext + SortableContext
              (ITEM-02 / RESEARCH Pattern 1). Cross-category MOVE is computed in
              handleDragEnd → reorderItem (one {category, position} write). */}
          {!itemsLoading && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={flatItemIds}
                strategy={verticalListSortingStrategy}
              >
                {grouped.map((group) => (
                  <CategorySection
                    key={group.category}
                    category={group.category}
                    items={group.items}
                    editingItemId={editingItemId}
                    deletingItemId={deletingItemId}
                    onItemTap={handleItemTap}
                    onCancelEdit={handleCancelEdit}
                    onSave={handleSave}
                    onStep={handleStep}
                    onDelete={handleDelete}
                    onConfirmDelete={handleConfirmDelete}
                    onCancelDelete={handleCancelDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* Action stack — bulk actions only rendered when checked items exist (D-06).
              Uncheck all (SHOP-06) sits with Clear completed (UI-SPEC §2). */}
          {!itemsLoading && checkedCount > 0 && (
            <div className="px-4 flex flex-col gap-2 mt-4">
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={() => setUncheckDialogOpen(true)}
              >
                Uncheck all ({checkedCount})
              </Button>
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={() => setClearDialogOpen(true)}
              >
                Clear completed ({checkedCount})
              </Button>
            </div>
          )}

          {/* Undo-clear snackbar (SHOP-05) — bottom of list content, inline (UI-SPEC §1).
              Self-gates on lastCleared (renders null when empty). */}
          <UndoSnackbar />

          {/* Android install affordance (PWA-01 / D-10) — inline at list bottom,
              mirroring UndoSnackbar. Self-gates (canInstall && !standalone &&
              !sessionDismissed); no dismissedBanners wrapper. */}
          <InstallPrompt />
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

      {/* Uncheck-all confirmation dialog (SHOP-06 / D-05) — mirrors the Clear dialog
          exactly; disablePointerDismissal blocks accidental backdrop tap mid-shop. */}
      <Dialog
        open={uncheckDialogOpen}
        onOpenChange={(open) => setUncheckDialogOpen(open)}
        disablePointerDismissal
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Uncheck {checkedCount} item{checkedCount !== 1 ? 's' : ''}?
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUncheckDialogOpen(false)}>
              Keep checked
            </Button>
            <Button
              variant="destructive"
              onClick={handleUncheckConfirm}
            >
              Uncheck all
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

      {/* Members management dialog (D-07 / MEMBER-01/02) */}
      <MembersDialog
        listId={list.id}
        listName={displayName ?? list.name}
        ownerId={list.owner_id ?? ''}
        members={listMembers?.map(m => ({ user_id: m.user_id, joined_at: m.created_at }))}
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        onMembersChanged={() => fetchListMembers(list.id)}
      />
    </div>
  )
}
