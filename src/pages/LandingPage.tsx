import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'
import type { List } from '@/types/list'
import LoginPage from '@/components/auth/LoginPage'
import CreateListForm from '@/components/CreateListForm'
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

export default function LandingPage() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const error = useAuthStore((state) => state.error)
  const navigate = useNavigate()

  const listsStoreState = useListsStore()
  const lists: List[] = listsStoreState?.lists ?? []
  const listsLoading: boolean = listsStoreState?.loading ?? false
  const listsError: string | null = listsStoreState?.error ?? null
  const fetchLists = listsStoreState?.fetchLists
  const renameList = listsStoreState?.renameList
  const deleteList = listsStoreState?.deleteList

  // Inline rename UI state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [renameError, setRenameError] = useState(false)
  const [renamePending, setRenamePending] = useState(false)

  // Delete dialog UI state
  const [deleteTarget, setDeleteTarget] = useState<List | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Return-to-URL: navigate to stored path after sign-in (D-04)
  useEffect(() => {
    if (user) {
      const returnTo = sessionStorage.getItem('returnTo')
      if (returnTo && returnTo !== '/') {
        sessionStorage.removeItem('returnTo')
        navigate(returnTo, { replace: true })
      }
    }
  }, [user, navigate])

  // Fetch owned lists on mount when user is available
  useEffect(() => {
    if (user && fetchLists) {
      fetchLists(user.id)
    }
  }, [user, fetchLists])

  // Loading guard: never flash login or content before auth state resolves
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  // Unauthenticated: show login screen
  if (!user) {
    return <LoginPage onSignIn={signInWithGoogle} error={error} />
  }

  async function handleRename() {
    if (!editingName.trim()) {
      setRenameError(true)
      return
    }
    setRenameError(false)
    setRenamePending(true)
    if (renameList) {
      await renameList(editingId!, editingName.trim())
    }
    setRenamePending(false)
    setEditingId(null)
  }

  function cancelRename() {
    setEditingId(null)
    setRenameError(false)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || !deleteList) return
    setDeleteLoading(true)
    await deleteList(deleteTarget.id)
    setDeleteLoading(false)
    setDeleteTarget(null)
  }

  // Authenticated: show lists-home
  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mt-8">Our Cart</h1>

      {/* Create affordance */}
      <section className="w-full max-w-sm mt-6">
        <h2 className="text-xl font-bold mb-3">Create a list</h2>
        <CreateListForm />
      </section>

      {/* Owned lists collection */}
      <section className="w-full max-w-sm mt-6">
        {lists.length > 0 && (
          <h2 className="text-xl font-bold mb-2">Your lists</h2>
        )}

        {listsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : listsError ? (
          <p className="text-sm text-destructive mt-2" role="alert">
            Could not load your lists. Please refresh.
          </p>
        ) : lists.length === 0 ? (
          <div>
            <p className="text-sm font-normal text-muted-foreground">No lists yet</p>
            <p className="text-sm text-muted-foreground">Create your first list above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {lists.map((list) =>
              editingId === list.id ? (
                <li key={list.id} className="flex items-center gap-2 min-h-[48px] py-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    aria-label="Rename list"
                    className="flex-1 h-7 text-sm"
                    autoFocus
                  />
                  {renameError && (
                    <p className="text-xs text-destructive">Name cannot be empty.</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRename}
                    disabled={renamePending}
                  >
                    {renamePending ? 'Saving…' : 'Save name'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelRename}>
                    Cancel
                  </Button>
                </li>
              ) : (
                <li key={list.id} className="flex items-center justify-between min-h-[48px]">
                  <Link
                    to={`/list/${list.share_code}`}
                    className="flex-1 py-3 text-sm font-normal truncate"
                  >
                    {list.name}
                  </Link>
                  <div className="flex items-center gap-2 pl-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Rename ${list.name}`}
                      onClick={() => {
                        setEditingId(list.id)
                        setEditingName(list.name)
                        setRenameError(false)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${list.name}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(list)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </section>

      {/* Delete confirmation dialog (D-08) — disablePointerDismissal prevents
          accidental backdrop tap on mobile */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        disablePointerDismissal
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete &apos;{deleteTarget?.name}&apos;?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            This removes the list and all its items permanently.
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleteLoading}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={handleDeleteConfirm}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
