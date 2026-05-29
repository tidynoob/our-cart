# Phase 7: Lists Infrastructure - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 7 (2 NEW, 1 NEW test, 1 NEW type, 3 MODIFY)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/stores/listsStore.ts` | store | CRUD + optimistic | `src/stores/itemsStore.ts` | exact (same optimistic+rollback pattern) |
| `src/stores/listsStore.test.ts` | test | unit | `src/stores/authStore.test.ts` | exact (vi.hoisted + setState reset) |
| `src/types/list.ts` | model | — | `src/types/item.ts` | exact (interface shape) |
| `src/components/CreateListForm.tsx` | component | request-response | self (modify) | — |
| `src/pages/LandingPage.tsx` | page | CRUD + request-response | self (modify) | — |
| `src/pages/ListPage.tsx` | page | CRUD + request-response | self (modify, delete affordance) | — |
| Dialog reuse (delete confirmation) | component | request-response | `src/pages/ListPage.tsx` lines 317–342 | exact |

---

## Pattern Assignments

### `src/types/list.ts` (model — NEW)

**Analog:** `src/types/item.ts`

**Full analog** (lines 1–14):
```typescript
/**
 * Item interface matching the Supabase `items` table schema.
 * All field names use snake_case to match database column names.
 */
export interface Item {
  id: string
  list_id: string
  name: string
  quantity: string | null
  category: string | null
  checked: boolean
  added_by: string | null
  created_at: string
}
```

**New file — clone this shape, swap fields for `lists` schema:**
```typescript
/**
 * List interface matching the Supabase `lists` table schema.
 * All field names use snake_case to match database column names.
 */
export interface List {
  id: string
  name: string
  share_code: string
  owner_id: string        // always set in v2.0; legacy NULL rows handled at fetch layer
  created_at: string
}
```

Note: `owner_id` typed as `string` (not `string | null`) because v2.0 always sets it; the store's `.eq('owner_id', userId)` filter means NULL rows never enter the store.

---

### `src/stores/listsStore.ts` (store, CRUD — NEW)

**Analog:** `src/stores/itemsStore.ts`

**Imports pattern** (itemsStore lines 1–5 — copy structure, swap types/table):
```typescript
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/item'
```
Replace `Item` with `List`, no `RealtimeChannel` import needed (no realtime on lists in Phase 7).

**State interface pattern** (itemsStore lines 18–42 — simplified, no realtime fields):
```typescript
interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
  syncStatus: 'connecting' | 'live' | 'reconnecting'
  channel: RealtimeChannel | null

  fetchItems: (listId: string, options?: { background?: boolean }) => Promise<void>
  addItem: (...) => Promise<void>
  updateItem: (...) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  toggleChecked: (id: string) => Promise<void>
  clearChecked: (listId: string) => Promise<void>
  subscribeToList: (listId: string) => void
  unsubscribe: () => void
}
```
For `listsStore`, drop `syncStatus`, `channel`, `subscribeToList`, `unsubscribe`. Keep `lists`, `loading`, `error` plus 4 actions: `fetchLists`, `createList`, `renameList`, `deleteList`.

**Store creation pattern** (itemsStore line 44):
```typescript
export const useItemsStore = create<ItemsState>()((set, get) => ({
```
Copy exactly — `(set, get)` signature (both needed: `get` is required for snapshot-before-set rollback pattern).

**fetchItems pattern** (itemsStore lines 51–71 — the fetch skeleton to clone):
```typescript
fetchItems: async (listId, { background = false } = {}) => {
  if (!background) {
    set({ loading: true, error: null })
  } else {
    set({ error: null })
  }
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true })

  if (error) {
    set({ error: 'Failed to load items', loading: false })
  } else {
    set({ items: data ?? [], loading: false })
  }
},
```
For `fetchLists`: no `background` option needed. Query `.eq('owner_id', userId)` (D-05). Order `ascending: false` (newest first). Select `'id, name, share_code, owner_id, created_at'` explicitly.

**addItem / optimistic-create pattern** (itemsStore lines 73–119 — the template for `createList`):
```typescript
addItem: async (listId, name, quantity, category, addedBy) => {
  const tempId = nanoid()
  const optimisticItem: Item = {
    id: tempId,
    list_id: listId,
    name,
    // ...other fields
    created_at: new Date().toISOString(),
  }
  set((state) => ({ items: [...state.items, optimisticItem] }))

  const { data, error } = await supabase
    .from('items')
    .insert({ list_id: listId, name, ... })
    .select()
    .single()

  if (error) {
    set((state) => ({
      items: state.items.filter((i) => i.id !== tempId),
      error: 'Failed to add item',
    }))
  } else if (data) {
    set((state) => ({
      items: state.items.map((i) => (i.id === tempId ? data : i)),
    }))
  }
},
```
For `createList(name, userId)`: `tempId = nanoid()`, `shareCode = nanoid(8)`, optimistic row prepended (`[optimisticList, ...state.lists]`). Insert payload: `{ name: name.trim(), share_code: shareCode, owner_id: userId }`. On success replace tempId row with real DB row.

**updateItem pattern** (itemsStore lines 121–145 — the template for `renameList`):
```typescript
updateItem: async (id, changes) => {
  const prev = get().items.find((i) => i.id === id)   // CRITICAL: snapshot BEFORE set()
  if (!prev) return

  set((state) => ({
    items: state.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
  }))

  const { error } = await supabase
    .from('items')
    .update(changes)
    .eq('id', id)

  if (error) {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? prev : i)),
      error: 'Failed to update item',
    }))
  }
},
```
For `renameList(id, name)`: snapshot `prev = get().lists.find(...)`, optimistic name replace, `supabase.from('lists').update({ name: name.trim() }).eq('id', id)`, rollback to `prev` on error.

**deleteItem pattern** (itemsStore lines 147–171 — the template for `deleteList`):
```typescript
deleteItem: async (id) => {
  const prev = get().items.find((i) => i.id === id)   // CRITICAL: snapshot BEFORE set()
  if (!prev) return

  set((state) => ({
    items: state.items.filter((i) => i.id !== id),
  }))

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) {
    set((state) => ({
      items: [...state.items, prev],
      error: 'Failed to delete item',
    }))
  }
},
```
For `deleteList(id)`: identical structure, swap `items` → `lists`, `supabase.from('lists')`. Rollback re-inserts list row: `lists: [...state.lists, prev]`. Error string: `'Failed to delete list'`.

---

### `src/stores/listsStore.test.ts` (test — NEW)

**Analog:** `src/stores/authStore.test.ts`

**vi.hoisted mock setup pattern** (authStore.test.ts lines 1–40 — copy this skeleton):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

const {
  mockOnAuthStateChange,
  mockSignInWithOAuth,
  mockSignOut,
  mockSetAuth,
  captureCallback,
  resetCapturedCb,
  getMockUnsubscribe,
} = vi.hoisted(() => {
  let _capturedCb: ((event: string, session: unknown) => void) | null = null
  const _mockUnsubscribe = vi.fn()
  return {
    mockOnAuthStateChange: vi.fn().mockImplementation((cb) => {
      _capturedCb = cb
      return { data: { subscription: { unsubscribe: _mockUnsubscribe } } }
    }),
    // ...other mocks
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: mockOnAuthStateChange, ... },
    realtime: { setAuth: mockSetAuth },
  },
}))
```

For `listsStore.test.ts`, the `vi.hoisted` block must return a **chainable Supabase builder mock** because `listsStore` uses `supabase.from('lists').select().eq().order()` and `.insert().select().single()` etc. Use this builder pattern:

```typescript
const { mockFrom, mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockOrder, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockOrder = vi.fn().mockReturnThis()
  const mockEq = vi.fn().mockReturnThis()
  const mockSelect = vi.fn().mockReturnThis()
  const mockInsert = vi.fn().mockReturnThis()
  const mockUpdate = vi.fn().mockReturnThis()
  const mockDelete = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
  })
  return { mockFrom, mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockOrder, mockSingle }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))
```

**beforeEach reset pattern** (authStore.test.ts lines 43–51):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  resetCapturedCb()
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  })
})
```
For `listsStore.test.ts`:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  useListsStore.setState({ lists: [], loading: false, error: null })
})
```

**Test assertion pattern** (authStore.test.ts lines 54–58):
```typescript
it('calls supabase.auth.onAuthStateChange exactly once (AUTH-01)', () => {
  useAuthStore.getState().initialize()
  expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
})
```
For listsStore tests, call actions via `await useListsStore.getState().fetchLists('user-1')` then assert `useListsStore.getState().lists` / `.error` / `.loading`. Check `mockFrom` called with `'lists'`, and `mockEq` called with `('owner_id', 'user-1')`.

---

### `src/components/CreateListForm.tsx` (component, MODIFY)

**Current insert (line 28–30) — the line to change:**
```typescript
const { error: supabaseError } = await supabase
  .from('lists')
  .insert({ name: name.trim(), share_code: shareCode })
```

**Integration point (D-04):** Replace the direct Supabase call with `listsStore.createList`. The component needs access to `user.id`:
```typescript
// Add at top of function body:
const user = useAuthStore((state) => state.user)
const createList = useListsStore((state) => state.createList)

// Replace the supabase.from('lists').insert block with:
await createList(name.trim(), user!.id)
// navigate is still needed — pass shareCode back from createList, or navigate in store
```

**Validation pattern to preserve** (lines 17–19):
```typescript
if (!name.trim()) {
  setError('Please enter a list name.')
  return
}
```
Keep this unchanged. Reuse for rename validation in the lists-home row.

**Loading/error pattern to preserve** (lines 11–12, 33–36):
```typescript
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
// ...
setError('Could not create list. Please try again.')
setLoading(false)
```
Keep the generic error string pattern — never expose `error.message` from Supabase.

**Navigation**: After `createList`, navigate to `/list/${shareCode}`. The `createList` store action returns void currently; either return the share_code from the action, or keep shareCode generated in the component and pass it to the action as a param. Simpler: keep `shareCode = nanoid(8)` in the component and pass it to the store action signature `createList(name, userId, shareCode)`, or generate in the store and navigate from the page via a returned value.

---

### `src/pages/LandingPage.tsx` (page, MODIFY)

**Current authenticated branch** (lines 41–55 — the block to replace):
```typescript
// Authenticated: show create/join list forms
return (
  <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
    <h1 className="text-3xl font-bold">Our Cart</h1>

    <section className="flex flex-col items-center gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold">Create a list</h2>
      <CreateListForm />
    </section>

    <section className="flex flex-col items-center gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold">Join a list</h2>
      <JoinListForm />
    </section>
  </main>
)
```

**What to remove:** The `JoinListForm` import (line 6) and the entire "Join a list" section (lines 50–53). Per D-09.

**Spinner pattern to reuse** (lines 27–33 — loading guard, keep unchanged):
```typescript
if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}
```
Reuse exact same spinner markup for `listsStore.loading` state inside the lists collection section.

**useEffect pattern to reuse** (lines 15–24 — returnTo navigation, keep unchanged):
```typescript
useEffect(() => {
  if (user) {
    const returnTo = sessionStorage.getItem('returnTo')
    if (returnTo && returnTo !== '/') {
      sessionStorage.removeItem('returnTo')
      navigate(returnTo, { replace: true })
    }
  }
}, [user, navigate])
```

**New useEffect to add** — fetch lists on mount when user is available:
```typescript
const fetchLists = useListsStore((state) => state.fetchLists)
const lists = useListsStore((state) => state.lists)
const listsLoading = useListsStore((state) => state.loading)
const listsError = useListsStore((state) => state.error)

useEffect(() => {
  if (user) {
    fetchLists(user.id)
  }
}, [user, fetchLists])
```

**Return-to URL behavior note:** The existing `returnTo` useEffect fires before the lists-home renders — this is correct. If `returnTo` is set, the user bounces to `/list/:code` immediately; the lists-home never renders that mount. No conflict.

---

### `src/pages/ListPage.tsx` (page, MODIFY)

**Local List interface** (lines 22–27 — add `owner_id` field):
```typescript
interface List {
  id: string
  name: string
  share_code: string
  created_at: string
}
```
Add `owner_id: string` to this interface so the owner guard can work.

**Fetch query** (line 69 — add `owner_id` to select):
```typescript
.select('id, name, share_code, created_at')
```
Change to:
```typescript
.select('id, name, share_code, owner_id, created_at')
```

**Clear dialog pattern** (lines 317–342 — the exact template for the delete-list confirmation dialog):
```typescript
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
```
Clone this structure for the delete-list dialog. Key differences: add `DialogDescription` with "This removes the list and all its items permanently.", button labels "Cancel" / "Delete", handler calls `listsStore.deleteList(list.id)` then `navigate('/')`.

**New state to add** (mirror the `clearDialogOpen` pattern at lines 45–46):
```typescript
const [deleteListDialogOpen, setDeleteListDialogOpen] = useState(false)
```

**Navigate-away on delete** — the `navigate` hook is already imported and used in ListPage (line 2). After `deleteList` resolves, call `navigate('/')`.

**Owner guard** — use `useAuthStore` (already imported pattern from LandingPage) to get `user.id`. Show rename/delete affordances only when `user?.id === list.owner_id`.

**Dialog imports** — `DialogDescription` is not currently imported in ListPage (line 15–20 only imports `Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle`). Add `DialogDescription` to the import.

---

## Shared Patterns

### Supabase client
**Source:** `src/lib/supabase.ts`
**Apply to:** All new files calling Supabase
```typescript
import { supabase } from '@/lib/supabase'
```
Single shared client — never instantiate a new client.

### Generic error strings (never expose raw Supabase errors)
**Source:** `src/components/CreateListForm.tsx` lines 33–34
```typescript
setError('Could not create list. Please try again.')
```
**Apply to:** All store actions and component error handlers. Store actions use `'Failed to [verb] list'`; components that surface errors use the copy from 07-UI-SPEC.md copywriting contract.

### Optimistic snapshot-before-set rule
**Source:** `src/stores/itemsStore.ts` lines 122, 148 + comment at line 204
```typescript
// Snapshot BEFORE optimistic removal (Pitfall 4 — read before set())
const prev = get().items.find((i) => i.id === id)
if (!prev) return
```
**Apply to:** `renameList` and `deleteList` in `listsStore`. CRITICAL — calling `get()` after `set()` will return the already-mutated state.

### Destructive dialog pattern
**Source:** `src/pages/ListPage.tsx` lines 317–342
**Apply to:** Delete-list confirmation in `LandingPage.tsx` (lists-home row) and `ListPage.tsx`
Key props:
- `disablePointerDismissal` — mandatory on mobile (prevents accidental backdrop tap)
- `showCloseButton={false}` on `DialogContent` — forces explicit button choice
- `variant="destructive"` on the confirm button
- `variant="outline"` on the cancel button

### `useAuthStore` selector pattern
**Source:** `src/pages/LandingPage.tsx` lines 9–10
```typescript
const user = useAuthStore((state) => state.user)
const isLoading = useAuthStore((state) => state.isLoading)
```
**Apply to:** All components/pages that need `user.id` for store actions.

### Spinner markup
**Source:** `src/pages/LandingPage.tsx` lines 29–31
```typescript
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
```
**Apply to:** Lists-home loading state inside the lists collection section.

### vi.hoisted + setState reset test pattern
**Source:** `src/stores/authStore.test.ts` lines 14–51
```typescript
const { ... } = vi.hoisted(() => { ... })
vi.mock('@/lib/supabase', () => ({ supabase: { ... } }))
// In beforeEach:
useAuthStore.setState({ ... })
```
**Apply to:** `listsStore.test.ts` — same structure, chainable builder mock for Supabase CRUD chain.

---

## No Analog Found

All files have close analogs. No entries needed here.

---

## Key Anti-Pattern Notes for Planner

1. `createList` in the store generates the `share_code` (`nanoid(8)`). `CreateListForm` must NOT also call `supabase.from('lists').insert` — the parallel code path is exactly the bug that produced `owner_id = NULL`. Migrate `CreateListForm` to delegate entirely to `listsStore.createList`.
2. `deleteList` rollback re-inserts the list row as `[...state.lists, prev]` (appended, not prepended). This is fine — `fetchLists` keeps lists sorted; the rollback just needs to restore the item anywhere in the array.
3. No realtime channel on the `lists` table. Do not copy `subscribeToList`/`unsubscribe`/`channel`/`syncStatus` from `itemsStore` into `listsStore`.
4. `ListPage` fetch (`fetchList` by `share_code`) must survive — `listsStore.fetchLists` is called from `LandingPage`, not `ListPage`. `ListPage` reads its own local `list` state; name can additionally be derived from store cache to satisfy D-06 (rename reflection), but the independent fetch is the source of truth for direct URL nav.

---

## Metadata

**Analog search scope:** `src/stores/`, `src/pages/`, `src/components/`, `src/types/`
**Files read:** 8 source files + 3 planning docs
**Pattern extraction date:** 2026-05-28
