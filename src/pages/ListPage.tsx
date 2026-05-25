import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import { useItemsStore } from '@/stores/itemsStore'
import { groupItemsByCategory } from '@/lib/categories'
import type { Item } from '@/types/item'
import { ShareBanner } from '@/components/ShareBanner'
import { NamePromptDialog } from '@/components/NamePromptDialog'
import { AddItemBar } from '@/components/AddItemBar'
import { CategorySection } from '@/components/CategorySection'

interface List {
  id: string
  name: string
  share_code: string
  created_at: string
}

export default function ListPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const dismissedBanners = useUIStore((state) => state.dismissedBanners)
  const dismissBanner = useUIStore((state) => state.dismissBanner)
  const [list, setList] = useState<List | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  // Edit/delete state managed locally in ListPage (not Zustand)
  // Per review: these are ephemeral UI state for this page only
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  const items = useItemsStore((state) => state.items)
  const itemsLoading = useItemsStore((state) => state.loading)
  const itemsError = useItemsStore((state) => state.error)
  const fetchItems = useItemsStore((state) => state.fetchItems)
  const updateItem = useItemsStore((state) => state.updateItem)
  const deleteItem = useItemsStore((state) => state.deleteItem)

  // Lifecycle step 1: Fetch list by share code
  useEffect(() => {
    if (!code) {
      navigate('/')
      return
    }

    async function fetchList() {
      const { data, error: supabaseError } = await supabase
        .from('lists')
        .select('id, name, share_code, created_at')
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

  // Lifecycle step 2: Once list is loaded, fetch items and load stored name
  useEffect(() => {
    if (!list) return

    fetchItems(list.id)

    const storedName = localStorage.getItem(`our-cart-name-${list.id}`)
    if (storedName) {
      setUserName(storedName)
    }
  }, [list, fetchItems])

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

  return (
    <div className="min-h-screen flex flex-col items-center">
      {/* ShareBanner shown until dismissed (D-04) */}
      {!dismissedBanners.has(list.share_code) && (
        <ShareBanner
          listCode={list.share_code}
          listName={list.name}
          onDismiss={() => dismissBanner(list.share_code)}
        />
      )}

      {/* Name prompt dialog — shown when no stored name for this list */}
      <NamePromptDialog
        open={userName === null}
        listId={list.id}
        onNameSaved={(name) => setUserName(name)}
      />

      <div className="w-full max-w-md p-4">
        <h1 className="text-2xl font-semibold">{list.name}</h1>

        <div className="mt-4 flex flex-col gap-6">
          {/* Add item bar — disabled until the user's name is set so items
              can never be created anonymously if the name prompt is
              bypassed (WR-04). */}
          <AddItemBar
            listId={list.id}
            addedBy={userName || ''}
            disabled={userName === null}
          />

          {/* Items loading state */}
          {itemsLoading && (
            <p className="text-sm text-muted-foreground">Loading items...</p>
          )}

          {/* Items error state — covers both load failures and failed
              optimistic mutations (add/update/delete). The store sets a
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
            />
          ))}
        </div>
      </div>
    </div>
  )
}
