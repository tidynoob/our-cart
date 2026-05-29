# Phase 7: Lists Infrastructure - Research

**Researched:** 2026-05-28
**Domain:** Zustand store design, Supabase RLS authz, React Router navigation, optimistic CRUD UI
**Confidence:** HIGH — all findings are derived from direct inspection of the existing codebase and migration files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** URL identity stays `share_code` — routes remain `/list/:code`. Do not switch to list `id`.
- **D-02:** Phase 7 ships a minimal (non-throwaway) lists-home at `/` for authed users. Not the sidebar drawer — that is Phase 8. Keep visually plain.
- **D-03:** New `listsStore` Zustand store mirrors `itemsStore`/`authStore` pattern — `fetchLists`, `createList`, `renameList`, `deleteList`. `ListPage` must retain its independent `share_code` fetch path.
- **D-04:** On create, set `owner_id = auth.uid()` explicitly in app code. Planner may also add `DEFAULT auth.uid()` to the column as defense-in-depth.
- **D-05:** Lists-home query is owner-scoped: `.eq('owner_id', userId)`. Legacy `owner_id = NULL` lists do NOT appear.
- **D-06:** Rename = optimistic update in `listsStore` + `UPDATE lists SET name`. No realtime on lists table in Phase 7.
- **D-07:** Delete = `supabase.from('lists').delete().eq('id', listId)`. Cascade on `items.list_id` handles item removal. No new migration required.
- **D-08:** Delete confirmation via Dialog (same as clear-checked dialog in ListPage). Destructive button styling. Copy must include "and all its items." If deleting current list, `navigate('/')` after success.
- **D-09:** Retire `JoinListForm` from the authenticated landing. Direct `/list/:code` nav still works.
- **D-10:** Legacy `owner_id = NULL` lists stay accessible by direct URL but are unmanaged — not auto-claimed, not shown in lists-home.

### Claude's Discretion

- Empty-state copy/visual for zero-lists case on lists-home.
- Whether `lists.owner_id` also gets a DB `DEFAULT auth.uid()` or app-only assignment.
- Exact placement of per-list rename + delete affordances on lists-home (inline buttons vs. small menu).
- List name constraints: trim whitespace, require non-empty (duplicate names allowed).
- Whether `ListPage` reads from `listsStore` cache or keeps independent fetch for metadata (share_code path must survive).

### Deferred Ideas (OUT OF SCOPE)

- Claim legacy anonymous lists (D-10 deferral).
- Realtime list-name/collection sync across users (Phase 10 concern).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIST-01 | User can create a new named list | listsStore.createList pattern, owner_id assignment (D-04), share_code generation via nanoid(8), navigate to /list/:code after success |
| LIST-02 | User can rename an existing list | listsStore.renameList optimistic pattern (D-06), UPDATE lists SET name, reflected in lists-home + ListPage header |
| LIST-03 | User can delete a list (with confirmation dialog) | Dialog reuse (D-08), listsStore.deleteList optimistic remove + rollback, cascade deletes items (D-07), navigate to / if deleting current list |

</phase_requirements>

---

## Summary

Phase 7 is a pure application-layer phase — no new npm packages, no new DB migrations, and no new RLS policies needed. The existing `items.list_id ... references lists(id) ON DELETE CASCADE` (Phase 1 schema) and `lists_delete` RLS policy (`owner_id IS NULL OR (select auth.uid()) = owner_id`) already authorize and cascade-delete correctly. The primary deliverable is a new `listsStore` Zustand store that mirrors the `itemsStore` optimistic-update-plus-rollback pattern, a lists-home page replacing the authed branch of `LandingPage`, and targeted modifications to `CreateListForm` (add `owner_id`) and `ListPage` (add rename/delete affordances, navigate-away on own-list delete).

The Dialog component already supports the destructive confirmation pattern (used in ListPage's "Clear checked" flow). The `authStore` exposes `user.id` for owner-scoped queries. Routing stays unchanged — `/list/:code` via `ProtectedRoute`, lists-home at `/`. The only DB change that may be needed is an optional `DEFAULT auth.uid()` on `lists.owner_id` as defense-in-depth per D-04; this is a planner-discretion call and is a non-breaking `ALTER TABLE`.

**Primary recommendation:** Build `listsStore` first (it is the shared data source for lists-home, ListPage header, and the Phase 8 sidebar). All CRUD is app-level optimistic with Supabase as the persistence layer — no realtime channel on the lists table in this phase.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| listsStore CRUD | Client (Zustand store) | Database (Supabase Postgres + RLS) | Store owns optimistic state + rollback; DB is the source of truth |
| owner_id assignment on create | Client (store action) | Database (optional DEFAULT) | App-level ensures correctness; optional DB DEFAULT is defense-in-depth |
| Owner-scoped list fetch | Client (store action) | Database (RLS row filter) | `.eq('owner_id', userId)` in store; RLS enforces server-side as backstop |
| Lists-home page | Client (React page) | Client (listsStore) | Page reads store; store owns server data |
| Rename optimistic update | Client (store) | — | Single-session only; no realtime. Store propagates to all consumers via Zustand subscriptions |
| Delete + cascade | Client (store action) | Database (FK CASCADE) | Store sends DELETE; DB cascades items. No app-level item deletion needed |
| Delete confirmation dialog | Client (ListPage / lists-home) | — | Ephemeral UI state; same Dialog component as clear-checked |
| Navigate-away on delete | Client (React Router navigate) | — | `navigate('/')` after successful delete of the currently viewed list |
| Legacy list access (D-10) | Client (direct URL nav) | Database (RLS anon branch) | No lists-home entry; but `/list/:code` still works via existing RLS `owner_id IS NULL` branch |

---

## Standard Stack

No new packages required for this phase.

### Packages Already Installed

| Library | Installed Version | Purpose in Phase 7 |
|---------|------------------|---------------------|
| `zustand` | 5.0.13 | `listsStore` — same `create()` pattern as `itemsStore`/`authStore` |
| `@supabase/supabase-js` | 2.106.1 | Supabase CRUD on `lists` table |
| `nanoid` | 5.1.11 | `nanoid(8)` share code in `createList` action |
| `react-router-dom` | 7.15.1 | `useNavigate` for post-create/post-delete navigation |
| `@base-ui/react` | ^1.5.0 | Dialog primitive used by `dialog.tsx` |

**Installation:** No new `npm install` command needed. All dependencies are present.

### Package Legitimacy Audit

> No new packages — section not applicable. All packages above were installed and verified in prior phases (Phase 1, Phase 6).

---

## Architecture Patterns

### System Architecture Diagram

```
User action (create / rename / delete)
        │
        ▼
  listsStore action (Zustand)
        │
        ├──[optimistic]──► Zustand state update ──► lists-home re-renders (list row appears/updates/disappears)
        │                                        ──► ListPage header re-renders (if reading from store cache)
        │
        └──[async]──► supabase.from('lists').insert/update/delete
                            │
                            ├── success ──► replace temp id with real row (create only)
                            │              listsStore state already correct
                            │
                            └── error ──► rollback: restore previous state
                                          set error message
                                          (delete: re-insert the list row)
                                          (rename: restore old name)
                                          (create: remove optimistic row)

Delete success path:
        ├── if deleting from lists-home ──► list row disappears (already removed optimistically)
        └── if deleting current /list/:code ──► navigate('/') → "List not found" or lists-home
                                               (cascade removes items in DB; itemsStore cleared on unmount)
```

### Recommended Project Structure

```
src/
├── stores/
│   ├── itemsStore.ts     # existing — no changes needed
│   ├── authStore.ts      # existing — no changes needed
│   ├── uiStore.ts        # existing — no changes needed
│   └── listsStore.ts     # NEW — fetchLists / createList / renameList / deleteList
├── types/
│   ├── item.ts           # existing
│   └── list.ts           # NEW — List interface matching lists table schema
├── pages/
│   ├── LandingPage.tsx   # MODIFY — authed branch becomes lists-home, remove JoinListForm
│   └── ListPage.tsx      # MODIFY — add rename/delete affordance, owner-only guard, navigate-away
├── components/
│   ├── CreateListForm.tsx      # MODIFY — add owner_id to insert (D-04)
│   ├── JoinListForm.tsx        # RETIRE (remove from LandingPage; file can stay or be deleted)
│   └── ui/dialog.tsx           # existing — reuse as-is
```

### Pattern 1: listsStore — Optimistic CRUD with Rollback

Mirrors `itemsStore` exactly. Key structural elements verified from reading the existing store:

```typescript
// Source: src/stores/itemsStore.ts (verified pattern)
// listsStore.ts — structural outline

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import type { List } from '@/types/list'

interface ListsState {
  lists: List[]
  loading: boolean
  error: string | null

  fetchLists: (userId: string) => Promise<void>
  createList: (name: string, userId: string) => Promise<void>
  renameList: (id: string, name: string) => Promise<void>
  deleteList: (id: string) => Promise<void>
}

export const useListsStore = create<ListsState>()((set, get) => ({
  lists: [],
  loading: false,
  error: null,

  fetchLists: async (userId) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('owner_id', userId)           // D-05: owner-scoped (not IS NULL)
      .order('created_at', { ascending: false })
    if (error) {
      set({ error: 'Failed to load lists', loading: false })
    } else {
      set({ lists: data ?? [], loading: false })
    }
  },

  createList: async (name, userId) => {
    const tempId = nanoid()             // temp id for optimistic row
    const shareCode = nanoid(8)         // D-01: nanoid(8) — same as CreateListForm
    const optimisticList: List = {
      id: tempId,
      name: name.trim(),
      share_code: shareCode,
      owner_id: userId,                 // D-04: explicit owner_id
      created_at: new Date().toISOString(),
    }
    set((state) => ({ lists: [optimisticList, ...state.lists] }))

    const { data, error } = await supabase
      .from('lists')
      .insert({ name: name.trim(), share_code: shareCode, owner_id: userId })
      .select()
      .single()

    if (error) {
      set((state) => ({
        lists: state.lists.filter((l) => l.id !== tempId),
        error: 'Failed to create list',
      }))
    } else if (data) {
      set((state) => ({
        lists: state.lists.map((l) => (l.id === tempId ? data : l)),
      }))
    }
  },

  renameList: async (id, name) => {
    const prev = get().lists.find((l) => l.id === id)
    if (!prev) return
    set((state) => ({
      lists: state.lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)),
    }))
    const { error } = await supabase
      .from('lists')
      .update({ name: name.trim() })
      .eq('id', id)
    if (error) {
      set((state) => ({
        lists: state.lists.map((l) => (l.id === id ? prev : l)),
        error: 'Failed to rename list',
      }))
    }
  },

  deleteList: async (id) => {
    const prev = get().lists.find((l) => l.id === id)
    if (!prev) return
    set((state) => ({ lists: state.lists.filter((l) => l.id !== id) }))
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', id)
    if (error) {
      set((state) => ({
        lists: [...state.lists, prev],
        error: 'Failed to delete list',
      }))
    }
  },
}))
```

**[VERIFIED: codebase]** — pattern transcribed directly from `src/stores/itemsStore.ts` with adaptations for the `lists` table schema.

### Pattern 2: List Type Definition

```typescript
// src/types/list.ts — NEW file
// Mirrors src/types/item.ts pattern (verified)
export interface List {
  id: string
  name: string
  share_code: string
  owner_id: string        // always set in v2.0 — legacy NULL handled at fetch layer
  created_at: string
}
```

**[VERIFIED: codebase]** — schema confirmed from `lists_auth.sql` column definition and Phase 6 D-11.

### Pattern 3: owner_id Assignment on Create (D-04)

The `CreateListForm` currently does:
```typescript
// Source: src/components/CreateListForm.tsx (verified — line 30)
await supabase.from('lists').insert({ name: name.trim(), share_code: shareCode })
// owner_id is OMITTED — produces NULL even for authed users (tech debt)
```

Fix: either migrate `CreateListForm` to call `listsStore.createList()` (preferred — single code path), or add `owner_id` directly to the insert.

**`items.user_id` comparison [VERIFIED: codebase]:** `items_auth.sql` line 15 sets `DEFAULT auth.uid()` on `items.user_id`. `lists_auth.sql` has NO default on `lists.owner_id` (confirmed line 13 — comment says "No DEFAULT on owner_id — lists are created in application code, which will pass owner_id explicitly in Phase 7"). The DB DEFAULT on `owner_id` is a planner-discretion defense-in-depth add per D-04.

### Pattern 4: Dialog Reuse for Delete Confirmation (D-08)

The Dialog is `@base-ui/react` Dialog wrapped in `src/components/ui/dialog.tsx`. The clear-checked implementation in `ListPage.tsx` is the exact pattern to copy:

```typescript
// Source: src/pages/ListPage.tsx lines 318-342 (verified)
<Dialog open={clearDialogOpen} onOpenChange={(open) => setClearDialogOpen(open)} disablePointerDismissal>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Remove {checkedCount} checked item{checkedCount !== 1 ? 's' : ''}?</DialogTitle>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setClearDialogOpen(false)}>Keep Items</Button>
      <Button variant="destructive" onClick={handleClearConfirm}>Clear Items</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

For list delete, use the same structure. Copy to include "and all its items" per D-08 and specifics note.

**[VERIFIED: codebase]** — `dialog.tsx` uses `@base-ui/react` Dialog primitives, not shadcn Radix (confirmed line 4 of `dialog.tsx`). `disablePointerDismissal` is a prop accepted by `DialogPrimitive.Root` (passed through `...props`). The `showCloseButton={false}` + `variant="destructive"` is the established destructive pattern.

### Pattern 5: Auth User ID in Store Actions

`authStore` exposes `user: User | null`. To get `user.id` for the `fetchLists` and `createList` calls:

```typescript
// Source: src/stores/authStore.ts (verified)
import { useAuthStore } from '@/stores/authStore'

// In a component/page:
const user = useAuthStore((state) => state.user)
// Then pass user.id to listsStore actions
// Guard: if (!user) return  — LandingPage already guards on isLoading + user
```

### Pattern 6: LandingPage Authed Branch Replacement (D-02, D-09)

Current authed branch (verified from `LandingPage.tsx` lines 41-55) renders `CreateListForm` + `JoinListForm` inside a flex column. The lists-home replaces this with:
- `fetchLists(user.id)` call on mount (useEffect)
- List of owned lists (from `listsStore.lists`)
- Per-list rename + delete affordances (inline or small button group)
- `CreateListForm` (or inline create form calling `listsStore.createList`)
- Empty state when `lists.length === 0`

`JoinListForm` is retired from this view (D-09). The file and component can be kept or deleted — it is no longer imported.

### Pattern 7: ListPage Rename/Delete Affordance

Per D-03, the `share_code` fetch in `ListPage` must remain. The ListPage can additionally:
- Read `list.name` from `listsStore` cache (if list is already loaded) for instant rename reflection
- Show owner-only rename/delete controls (check `user.id === list.owner_id` — requires adding `owner_id` to the select query in `ListPage`'s fetch)
- On delete success: `navigate('/')`

Current `ListPage` local `List` interface (line 22-27) only selects `id, name, share_code, created_at`. To support owner check, add `owner_id` to the select and interface.

### Anti-Patterns to Avoid

- **Calling `fetchLists` before auth resolves:** Guard on `user` from `authStore` — never fetch with `null` userId. `LandingPage` already guards on `isLoading` and `!user`.
- **Skipping optimistic rollback on delete:** A failed list delete must re-insert the list row — match `itemsStore.deleteItem` pattern exactly.
- **Reading prev state after `set()`:** Snapshot `get().lists.find(...)` BEFORE calling `set()` for rollback. `itemsStore.clearChecked` comments this explicitly ("Pitfall 4 — read before set()").
- **Realtime channel on lists table:** Not required, not desired in Phase 7. Single-user view; partner sharing comes in Phase 10.
- **Navigating to `/list/:shareCode` from lists-home without going through the store:** The store's `createList` action generates the share code; the caller navigates using the temp/real share code. Do not call `supabase.from('lists').insert` from the page — all DB calls go through the store.
- **Using bare `auth.uid()` in RLS policies:** The existing policies use `(select auth.uid())`. Any new migration for the optional DEFAULT must follow the same pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic list state | Custom reducer + undo stack | Zustand `set()` + snapshot rollback (exact itemsStore pattern) | Pattern already proven in this codebase; consistent behavior |
| Accessible dialog | Custom modal overlay | Existing `dialog.tsx` wrapping `@base-ui/react` | Already installed, accessibility handled, `disablePointerDismissal` works on mobile |
| Share code generation | `Math.random()` or UUID | `nanoid(8)` (already installed) | Cryptographically secure, URL-safe, 8-char — same as existing lists |
| Owner-scoped fetch | Manual filter in JS | `.eq('owner_id', userId)` in Supabase query | RLS enforces server-side; query filter is correct client hint |
| DB cascade | App-level loop deleting items before list | `items.list_id ... references lists(id) ON DELETE CASCADE` (already in schema) | Phase 1 schema already has cascade; no migration needed |

**Key insight:** Every piece of infrastructure this phase needs already exists. The phase is about wiring it together, not building new primitives.

---

## Common Pitfalls

### Pitfall 1: owner_id NULL on create (Tech Debt D-04)

**What goes wrong:** `CreateListForm` does not pass `owner_id` to the insert. An authed user gets `owner_id = NULL`. The list passes RLS (via the `owner_id IS NULL` branch) but won't appear on the lists-home query (which filters by `owner_id = userId`), and delete/rename from the store will also silently pass (the RLS `IS NULL` branch authorizes it) but the user can't find their list.

**Why it happens:** `CreateListForm` was built pre-auth. `lists_auth.sql` explicitly has NO default on `owner_id` (comment on line 9: "No DEFAULT on owner_id — lists are created in application code").

**How to avoid:** Migrate `CreateListForm` to call `listsStore.createList(name, user.id)` rather than calling Supabase directly. This is the single correct code path. Do not leave a parallel Supabase insert in `CreateListForm`.

**Warning signs:** A newly created list does not appear on the lists-home; `lists` table has `owner_id = NULL` rows for authed users.

### Pitfall 2: Delete optimistic rollback ordering

**What goes wrong:** On delete error, the list row is not re-inserted into the store, so the user's list appears to vanish even though the DB delete failed.

**Why it happens:** Forgetting to snapshot `prev` before `set()` removes the row, or forgetting to restore it in the error branch.

**How to avoid:** Follow `itemsStore.deleteItem` exactly — snapshot `prev = get().lists.find(...)`, then `set(state => ({ lists: state.lists.filter(...) }))`, then on error `set(state => ({ lists: [...state.lists, prev] }))`.

### Pitfall 3: ListPage delete navigation race

**What goes wrong:** Navigating to `/` before the Supabase delete resolves, leaving the list still in the DB. Or: navigating only on success but forgetting to call `navigate` at all.

**Why it happens:** Async fire-and-forget without awaiting the store action.

**How to avoid:** In the delete handler: `await listsStore.deleteList(id)` (or check error state), then `navigate('/')`. The optimistic remove happens synchronously before the await, so the UX feels instant; navigation happens after confirmation of DB success (or can happen optimistically too — planner decides).

**Warning signs:** Navigating back to the deleted list URL shows the list is still there.

### Pitfall 4: ListPage "List not found" not triggered for deleted lists

**What goes wrong:** After deleting a list from the lists-home (not from ListPage), navigating to `/list/:code` still shows the list because the local `ListPage` state has the old data cached.

**Why it happens:** `ListPage` fetches list data by `share_code` on mount, but if navigated to a deleted list, the Supabase query returns `{data: null, error: {...}}` → the existing "List not found" path handles this correctly. This is actually not a pitfall — it works. The risk is thinking you need to add special handling.

**How to avoid:** Verify the existing error path in `ListPage.tsx` (lines 205-214) is sufficient — it renders "List not found" + link to home. It is.

### Pitfall 5: Rename not reflected in ListPage header

**What goes wrong:** Rename updates `listsStore.lists` optimistically, but `ListPage` reads `list.name` from its own local `useState` (set from the Supabase fetch on mount), not from the store.

**Why it happens:** `ListPage` currently has its own `const [list, setList] = useState<List | null>(null)` that is never updated by the store.

**How to avoid:** The planner has two options (D-03 discretion): (a) `ListPage` reads `list.name` from `listsStore` when the list is loaded in the store (derive name from store, fall back to local state), or (b) keep local state and accept that rename is reflected only on re-navigation. D-06 says "reflected immediately everywhere the name renders in the owner's session" — option (a) is required to satisfy D-06.

**Recommendation:** Add a selector `useListsStore(state => state.lists.find(l => l.id === list?.id)?.name ?? list?.name)` in ListPage to get the live name. This is the simplest approach without a refactor.

### Pitfall 6: RLS UPDATE policy requires USING + WITH CHECK

**What goes wrong:** An UPDATE-only RLS policy without `WITH CHECK` allows the update to read existing rows but rejects the write, producing a cryptic `permission denied` error.

**Why it happens:** Supabase RLS UPDATE requires both clauses. This is documented in STATE.md and is the established pattern in `lists_auth.sql` (lines 48-57) and `items_auth.sql`.

**How to avoid:** If a new migration is added for `DEFAULT auth.uid()` on `owner_id`, it is a DDL-only change (`ALTER TABLE`) and does not touch RLS policies — no `WITH CHECK` issue. Only relevant if Phase 7 adds or modifies policies (it should not need to).

---

## DB State Verification (D-07 — No New Migration Required)

**Cascade confirmed [VERIFIED: codebase]:**
```sql
-- Source: .planning/milestones/v1.0-phases/01-foundation/01-01-SUMMARY.md lines 173-179
create table items (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references lists (id) on delete cascade,
  ...
);
```
`ON DELETE CASCADE` is present. Deleting a list row auto-removes all its items — verified from Phase 1 schema SQL.

**Delete RLS confirmed [VERIFIED: codebase]:**
```sql
-- Source: supabase/migrations/lists_auth.sql lines 61-66
CREATE POLICY "lists_delete" ON lists FOR DELETE
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );
```
An authenticated user can delete their own list (`owner_id = auth.uid()`). The `IS NULL` branch also allows deleting legacy lists by anyone — this is the intentional permissive behavior from Phase 6 (legacy compatibility). Phase 7 does not need to tighten this.

**No new migration needed** unless the planner elects to add `DEFAULT auth.uid()` on `lists.owner_id`. If added:
```sql
-- Optional defense-in-depth migration (planner discretion — D-04)
ALTER TABLE lists
  ALTER COLUMN owner_id SET DEFAULT auth.uid();
```
This is a non-breaking DDL change. No policy changes required.

---

## Code Examples

### fetchLists — Owner-Scoped Query

```typescript
// Source: pattern derived from items_auth.sql + itemsStore.fetchItems (verified)
const { data, error } = await supabase
  .from('lists')
  .select('id, name, share_code, owner_id, created_at')
  .eq('owner_id', userId)           // D-05 — owner-scoped
  .order('created_at', { ascending: false })
```

### createList — With Explicit owner_id

```typescript
// Source: CreateListForm.tsx insert pattern (verified) + D-04 fix
const shareCode = nanoid(8)        // D-01: nanoid(8) — same pattern as existing CreateListForm
const { data, error } = await supabase
  .from('lists')
  .insert({ name: name.trim(), share_code: shareCode, owner_id: userId })
  .select()
  .single()
```

### Delete Confirmation Dialog — Copy Pattern

```typescript
// Source: ListPage.tsx lines 318-342 (verified — clear-checked dialog)
<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} disablePointerDismissal>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Delete '{listName}'?</DialogTitle>
    </DialogHeader>
    <DialogDescription>
      This removes the list and all its items permanently.
    </DialogDescription>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Rename Optimistic — Before/After Pattern

```typescript
// Source: itemsStore.updateItem pattern (verified — lines 121-145)
renameList: async (id, name) => {
  const prev = get().lists.find((l) => l.id === id)   // snapshot BEFORE set()
  if (!prev) return
  set((state) => ({
    lists: state.lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)),
  }))
  const { error } = await supabase.from('lists').update({ name: name.trim() }).eq('id', id)
  if (error) {
    set((state) => ({
      lists: state.lists.map((l) => (l.id === id ? prev : l)),
      error: 'Failed to rename list',
    }))
  }
}
```

---

## Routing (No Changes Required)

**[VERIFIED: codebase]** — `src/router.tsx` already has:
- `/` → `LandingPage` (unauthenticated = login; authenticated = lists-home after this phase)
- `/list/:code` → `ListPage` wrapped in `ProtectedRoute`
- `*` → `NotFoundPage`

No route additions needed. The lists-home is the existing `/` authenticated branch, not a new route. `LandingPage.tsx` is modified to replace the authed branch content, not replaced wholesale.

---

## Environment Availability

> Phase is code/DB-config only. All runtime dependencies were verified in Phases 1 and 6. No new external dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, npm | Already verified | 20.12.1 | — |
| Supabase project | All DB operations | Already provisioned | Free tier | — |
| `nanoid` | createList share code | ✓ (installed) | 5.1.11 | — |
| `zustand` | listsStore | ✓ (installed) | 5.0.13 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.3 + @testing-library/react 16.3.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIST-01 | `createList` adds optimistic row, calls supabase insert with owner_id + share_code | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ Wave 0 |
| LIST-01 | `createList` rolls back optimistic row on error | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ Wave 0 |
| LIST-01 | `fetchLists` queries with owner_id filter | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ Wave 0 |
| LIST-02 | `renameList` applies optimistic name update | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ Wave 0 |
| LIST-02 | `renameList` rolls back to previous name on error | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ Wave 0 |
| LIST-03 | `deleteList` removes row optimistically | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ Wave 0 |
| LIST-03 | `deleteList` rolls back on error (re-inserts list row) | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ Wave 0 |
| LIST-03 | Delete confirmation dialog renders with "and all its items" copy | unit | `npx vitest run src/pages/LandingPage.test.tsx` | ✅ exists (needs update) |
| LIST-03 | Cancel on dialog leaves list intact (dialog closes, no delete called) | unit | `npx vitest run src/pages/LandingPage.test.tsx` | ✅ exists (needs update) |

### Test Pattern (mirror authStore.test.ts)

The `authStore.test.ts` pattern is the correct model for `listsStore.test.ts`:

```typescript
// Pattern: vi.hoisted() mocks + vi.mock('@/lib/supabase') + useListsStore.setState({}) in beforeEach
// Source: src/stores/authStore.test.ts (verified — lines 1-41)
```

Key mocking requirements for `listsStore.test.ts`:
- Mock `@/lib/supabase` → `{ supabase: { from: vi.fn() → chainable builder } }`
- Reset store state in `beforeEach` via `useListsStore.setState({ lists: [], loading: false, error: null })`
- Supabase chained call mock: `from().insert().select().single()` — needs builder mock (more complex than authStore; see `itemsStore` pattern if tests exist)

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/stores/listsStore.test.ts` — covers LIST-01/02/03 (all 7 unit behaviors above)
- [ ] Update `src/pages/LandingPage.test.tsx` — existing 3 tests cover login/auth/loading; add tests for lists-home CRUD dialog behaviors (LIST-03 confirmation)

*(No new framework install — Vitest already configured and green)*

---

## Security Domain

**`security_enforcement: true`, `security_asvs_level: 1`** — ASVS L1 applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Indirect | `authStore.user.id` gates all store actions; `ProtectedRoute` already enforces auth on `/list/:code` |
| V3 Session Management | No | Handled in Phase 6; no session changes |
| V4 Access Control | Yes | Owner-only list mutation: `.eq('owner_id', userId)` in fetch; RLS `lists_delete` policy on delete |
| V5 Input Validation | Yes | List name: trim whitespace + require non-empty (reuse `CreateListForm` validation pattern) |
| V6 Cryptography | No | nanoid(8) already verified as cryptographically secure (Phase 1 tests) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User A deletes User B's list | Tampering | RLS `lists_delete` USING: `(select auth.uid()) = owner_id` prevents this at DB level |
| User A renames User B's list | Tampering | RLS `lists_update` WITH CHECK: `(select auth.uid()) = owner_id` prevents this at DB level |
| Empty/whitespace list name | Tampering | Client validation: `!name.trim()` before any Supabase call (already in `CreateListForm`, reuse for rename) |
| Authenticated user sees another user's lists | Info Disclosure | `fetchLists` query scoped to `.eq('owner_id', userId)` — only returns caller's lists |
| Deleting legacy anonymous list (D-10) | Tampering | RLS `IS NULL` branch allows any authenticated user to delete an anonymous list. This is the intentional Phase 6 legacy-compat behavior; Phase 7 does not change it. Acceptable for a 2-user household app. |

**No raw Supabase error messages exposed to UI** — follow `CreateListForm` pattern: generic error strings ("Failed to create list"), not `error.message`.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Direct Supabase calls from components (v1.0 CreateListForm) | Zustand store owns all DB calls | Store pattern established in itemsStore; Phase 7 extends it to lists |
| Anonymous list creation (no owner_id) | Explicit `owner_id = user.id` on insert | Tech debt D-04 resolved in this phase |
| Dual-form landing (Create + Join) | Lists-home with owned list collection | JoinListForm retired per D-09 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified by direct codebase inspection.** No training-data-only claims were made. No `[ASSUMED]` tags.

---

## Open Questions

1. **CreateListForm migration vs. parallel code path**
   - What we know: CreateListForm directly calls Supabase. listsStore.createList will also call Supabase.
   - What's unclear: Should CreateListForm be replaced by a form that calls listsStore, or should it remain as a standalone component that also sets owner_id?
   - Recommendation: Migrate CreateListForm to call `listsStore.createList` — eliminates the parallel code path and is the single source of truth for list creation.

2. **ListPage rename/delete — where to surface the affordance**
   - What we know: D-02 says Phase 7 lists-home has per-list controls. D-08 says delete from ListPage navigates to `/`.
   - What's unclear: Whether rename/delete is also surfaced directly on the ListPage header (in addition to lists-home controls).
   - Recommendation: Planner discretion per D-03 — minimal approach is lists-home only; ListPage can link back. But D-08 explicitly says "if the user deletes the list they are currently viewing" — implying delete is accessible from ListPage. Surface both locations.

3. **listsStore.lists pre-population on ListPage**
   - What we know: ListPage fetches list by share_code independently (D-03). listsStore may or may not have the list loaded.
   - What's unclear: Whether to call `listsStore.fetchLists` from ListPage as a side effect, or rely on LandingPage having fetched it already.
   - Recommendation: ListPage should NOT call fetchLists — it only navigates to /list/:code after LandingPage has already fetched. For direct URL access, keep the independent share_code fetch. Read name from store cache if available, fall back to local state (Pitfall 5 mitigation).

---

## Sources

### Primary (HIGH confidence)

All findings are from direct file reads of the codebase — no external documentation was required.

- `src/stores/itemsStore.ts` — optimistic CRUD + rollback pattern
- `src/stores/authStore.ts` — Zustand store structure, user.id access
- `src/stores/authStore.test.ts` — vi.hoisted mock pattern for store testing
- `src/components/CreateListForm.tsx` — existing insert (missing owner_id)
- `src/components/ui/dialog.tsx` — `@base-ui/react` Dialog wrapper, prop interface
- `src/pages/LandingPage.tsx` — authed branch to replace, JoinListForm to retire
- `src/pages/ListPage.tsx` — share_code fetch pattern, clear-checked dialog (delete confirmation template)
- `src/router.tsx` — route structure, no changes required
- `src/types/item.ts` — type pattern to mirror for `list.ts`
- `supabase/migrations/lists_auth.sql` — RLS policies (lists_delete confirmed), owner_id nullable with NO DEFAULT
- `supabase/migrations/items_auth.sql` — items.user_id DEFAULT auth.uid() (the asymmetry reference)
- `.planning/milestones/v1.0-phases/01-foundation/01-01-SUMMARY.md` — ON DELETE CASCADE confirmed in Phase 1 SQL
- `.planning/phases/06-auth-foundation/06-CONTEXT.md` — D-11 lists scaffolding, D-07 authStore pattern
- `.planning/phases/06-auth-foundation/06-VALIDATION.md` — Nyquist pattern for VALIDATION.md structure
- `.planning/v2.0-MILESTONE-AUDIT.md` — tech debt item (owner_id default asymmetry)
- `vitest.config.ts` — jsdom environment, globals: true, @ alias
- `package.json` — installed dependencies, no test script (uses `npx vitest run` directly)

---

## Metadata

**Confidence breakdown:**
- listsStore design: HIGH — transcribed directly from itemsStore
- DB cascade + RLS authz: HIGH — verified from migration files and Phase 1 SQL
- Dialog reuse: HIGH — verified from dialog.tsx + ListPage usage
- Routing: HIGH — verified from router.tsx
- Validation architecture: HIGH — modeled on 06-VALIDATION.md structure

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable codebase; no external dependencies)
