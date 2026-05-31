# Phase 10: List Sharing - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 8
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/list_members.sql` | migration | CRUD | `supabase/migrations/lists_auth.sql` | exact |
| `supabase/migrations/lists_membership.sql` | migration | CRUD | `supabase/migrations/lists_auth.sql` | exact |
| `supabase/migrations/items_membership.sql` | migration | CRUD | `supabase/migrations/items_auth.sql` | exact |
| `src/pages/InvitePage.tsx` | page/component | request-response | `src/pages/ListPage.tsx` + `src/components/auth/ProtectedRoute.tsx` | role-match |
| `src/router.tsx` (modify) | config/route | request-response | `src/router.tsx` | exact |
| `src/components/ShareBanner.tsx` (modify line 14) | component | request-response | `src/components/ShareBanner.tsx` | exact |
| `src/stores/listsStore.ts` (modify `fetchLists`) | store | CRUD | `src/stores/listsStore.ts` | exact |
| `src/pages/InvitePage.test.tsx` | test | request-response | `src/pages/ListPage.test.tsx` | role-match |
| `src/components/ShareBanner.test.tsx` (modify) | test | request-response | `src/components/ShareBanner.test.tsx` | exact |

---

## Pattern Assignments

### `supabase/migrations/list_members.sql` (migration, CRUD)

**Analog:** `supabase/migrations/lists_auth.sql`

**File header comment pattern** (lists_auth.sql lines 1-11):
```sql
-- Phase 6: Auth Foundation -- lists table auth scaffolding (D-11)
--
-- Adds nullable owner_id column to lists table for list ownership.
-- ...
-- Prerequisites: lists table exists with RLS already enabled (Phase 1).
-- Idempotent: Uses IF EXISTS on all DROP POLICY statements.
```
Copy this header format: phase reference, purpose, prerequisites, idempotency declaration.

**RLS enable + `(select auth.uid())` initPlan pattern** (lists_auth.sql lines 30-36):
```sql
CREATE POLICY "lists_select" ON lists FOR SELECT
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );
```
Use `(select auth.uid())` (subselect form) — never bare `auth.uid()` — for the initPlan query-planner optimization. Applies to all policy USING/WITH CHECK clauses.

**`DROP POLICY IF EXISTS` idempotency pattern** (lists_auth.sql lines 19-23):
```sql
DROP POLICY IF EXISTS "anon_select_lists" ON lists;
DROP POLICY IF EXISTS "anon_insert_lists" ON lists;
```
Every policy block must be preceded by a `DROP POLICY IF EXISTS` to make the migration re-runnable.

**New content for this file:**

Table DDL:
```sql
CREATE TABLE IF NOT EXISTS public.list_members (
  list_id    uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);
ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;
```

`is_list_member` SECURITY DEFINER helper (must come BEFORE the policies that call it; must NOT be called from `list_members` own policies — recursion risk):
```sql
CREATE OR REPLACE FUNCTION public.is_list_member(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.list_members
    WHERE list_id = p_list_id
      AND user_id = (SELECT auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_list_member(uuid) TO authenticated;
```

`list_members` own SELECT policy (uses only direct column check — no cross-table join — to avoid recursion):
```sql
DROP POLICY IF EXISTS "list_members_select" ON public.list_members;
CREATE POLICY "list_members_select" ON public.list_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
  );
-- No INSERT policy: direct inserts closed; only redeem_invite SECURITY DEFINER fn inserts
```

---

### `supabase/migrations/lists_membership.sql` (migration, CRUD)

**Analog:** `supabase/migrations/lists_auth.sql`

**Full DROP + recreate pattern** (lists_auth.sql lines 19-66 — the entire policy block):
```sql
DROP POLICY IF EXISTS "anon_select_lists" ON lists;
DROP POLICY IF EXISTS "anon_insert_lists" ON lists;
DROP POLICY IF EXISTS "anon_update_lists" ON lists;
DROP POLICY IF EXISTS "anon_delete_lists" ON lists;

CREATE POLICY "lists_select" ON lists FOR SELECT
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );
-- ... (each operation)
```

**New policy shape** — widen SELECT/UPDATE to owner-OR-member; DELETE stays owner-only (member cannot delete); INSERT unchanged:
```sql
DROP POLICY IF EXISTS "lists_select" ON public.lists;
CREATE POLICY "lists_select" ON public.lists FOR SELECT
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
    OR public.is_list_member(id)
  );

DROP POLICY IF EXISTS "lists_update" ON public.lists;
CREATE POLICY "lists_update" ON public.lists FOR UPDATE
  TO authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
    OR public.is_list_member(id)
  )
  WITH CHECK (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
    OR public.is_list_member(id)
  );

DROP POLICY IF EXISTS "lists_delete" ON public.lists;
CREATE POLICY "lists_delete" ON public.lists FOR DELETE
  TO authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );
-- DELETE stays owner-only. INSERT not widened.
```

**Ordering constraint:** This file must sort alphabetically AFTER `list_members.sql` (so `is_list_member` exists before it is called). Filename `lists_membership.sql` satisfies this — `list_members.sql` < `lists_membership.sql`.

---

### `supabase/migrations/items_membership.sql` (migration, CRUD)

**Analog:** `supabase/migrations/items_auth.sql`

**Existing items policy structure** (items_auth.sql lines 33-66):
```sql
-- SELECT: read items that are unowned (legacy) or owned by the current user
CREATE POLICY "items_select" ON items FOR SELECT
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );
-- same structure repeated for INSERT / UPDATE / DELETE
```

**New policy shape** — all four operations widen from "own items" to "items on accessible lists". `items.list_id` is the FK join key:
```sql
DROP POLICY IF EXISTS "items_select" ON public.items;
CREATE POLICY "items_select" ON public.items FOR SELECT
  TO anon, authenticated
  USING (
    list_id IN (SELECT id FROM public.lists WHERE owner_id IS NULL)
    OR list_id IN (SELECT id FROM public.lists WHERE owner_id = (select auth.uid()))
    OR public.is_list_member(list_id)
  );
-- Repeat USING shape for INSERT (WITH CHECK), UPDATE (USING + WITH CHECK), DELETE (USING)
```

**`redeem_invite` SECURITY DEFINER function** also lives in this file (dependency order: table + helper in `list_members.sql`, policy rewrites in `lists_membership.sql`, then this file which needs the widened lists SELECT to be in place):
```sql
CREATE OR REPLACE FUNCTION public.redeem_invite(p_share_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list_id    uuid;
  v_share_code text;
BEGIN
  SELECT id, share_code INTO v_list_id, v_share_code
  FROM public.lists
  WHERE share_code = p_share_code
  LIMIT 1;

  IF v_list_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.list_members (list_id, user_id)
  VALUES (v_list_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('list_id', v_list_id, 'share_code', v_share_code);
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
```

**`auth.uid()` note:** Available inside SECURITY DEFINER because PostgREST injects JWT claims context before the call. Both functions use `SET search_path = ''` to prevent search_path injection.

---

### `src/pages/InvitePage.tsx` (page, request-response)

**Analog A:** `src/pages/ListPage.tsx` — imports, `useParams`/`useNavigate`/`useEffect` structure

**Imports pattern** (ListPage.tsx lines 1-16):
```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
```
Use `@/` path alias (not relative `../`). No store import needed for InvitePage — RPC call is direct.

**`useParams` + `useEffect` on mount + `navigate` pattern** (ListPage.tsx lines 38-44, 92-114):
```typescript
const { code } = useParams<{ code: string }>()
const navigate = useNavigate()

useEffect(() => {
  if (!code) {
    navigate('/')
    return
  }
  async function fetchList() { ... }
  fetchList()
}, [code, navigate])
```
InvitePage uses the same destructuring (`{ code }`) and same `[code, navigate]` dependency array.

**Analog B:** `src/components/auth/ProtectedRoute.tsx` — spinner markup pattern

**Spinner pattern** (ProtectedRoute.tsx lines 10-16):
```typescript
return (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
  </div>
)
```
Copy this exact spinner markup for InvitePage's loading state.

**`supabase.rpc` call pattern** (from RESEARCH.md Pattern 5 — no codebase analog exists yet):
```typescript
const { data, error } = await supabase.rpc('redeem_invite', { p_share_code: code })
// data: null (unknown code) | { list_id: string, share_code: string }
if (error || !data) {
  setInvalid(true)
} else {
  navigate(`/list/${data.share_code}`, { replace: true })
}
```
Use `{ replace: true }` on the success navigate so back-button from `/list/:code` does not re-run the RPC.

**Invalid state markup** — minimal, phone-first, consistent with app's `text-sm` + `text-muted-foreground` convention:
```typescript
return (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
    <p className="text-sm text-muted-foreground">This invite link is invalid or has expired.</p>
    <a href="/" className="text-sm text-blue-600 underline">Back to home</a>
  </div>
)
```

**Component export pattern** (ListPage.tsx line 36): `export default function InvitePage()` — default export, PascalCase function name.

---

### `src/router.tsx` (config, modify)

**Analog:** `src/router.tsx` (self — the current file structure is the pattern)

**Current structure** (router.tsx lines 1-22):
```typescript
import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import ListPage from '@/pages/ListPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/AppShell'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/list/:code', element: <ListPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```

**Change:** Add `InvitePage` import and one new route entry inside `ProtectedRoute` but OUTSIDE `AppShell` (no sidebar during join flow):
```typescript
import InvitePage from '@/pages/InvitePage'

// Inside the ProtectedRoute children array, sibling to AppShell:
{ path: '/invite/:code', element: <InvitePage /> },
```

Result shape:
```typescript
{
  element: <ProtectedRoute />,
  children: [
    {
      element: <AppShell />,
      children: [
        { path: '/list/:code', element: <ListPage /> },
      ],
    },
    { path: '/invite/:code', element: <InvitePage /> },
  ],
},
```

---

### `src/components/ShareBanner.tsx` (component, modify — line 14 only)

**Analog:** `src/components/ShareBanner.tsx` (self)

**Current line 14:**
```typescript
  const shareUrl = `${window.location.origin}/list/${listCode}`
```

**Change to:**
```typescript
  const shareUrl = `${window.location.origin}/invite/${listCode}`
```

No other changes. Copy/Share button handlers, dismiss button, JSX, props interface — all unchanged.

---

### `src/stores/listsStore.ts` (store, modify — `fetchLists` action)

**Analog:** `src/stores/listsStore.ts` (self)

**Current `fetchLists`** (listsStore.ts lines 22-36):
```typescript
fetchLists: async (userId) => {
  set({ loading: true, error: null })

  const { data, error } = await supabase
    .from('lists')
    .select('id, name, share_code, owner_id, created_at')
    .eq('owner_id', userId)          // <-- DROP THIS LINE
    .order('created_at', { ascending: false })

  if (error) {
    set({ error: 'Failed to load lists', loading: false })
  } else {
    set({ lists: data ?? [], loading: false })
  }
},
```

**Change:** Remove `.eq('owner_id', userId)`. Keep everything else — `set` calls, error string, `data ?? []`, order direction. Keep `userId` parameter in the signature to avoid cascading caller changes (LandingPage, AppShell call `fetchLists(userId)`).

**Error string convention** (observed throughout store): `'Failed to load lists'` — lowercase, plain English, no punctuation. Match this style for any new error strings.

**No other store changes.** The `joinList`/`redeem` action is NOT added to the store — InvitePage calls `supabase.rpc` directly (D-03 decision: "thin route component calling an RPC, not new store state").

---

### `src/pages/InvitePage.test.tsx` (test, request-response)

**Analog:** `src/pages/ListPage.test.tsx`

**Import block pattern** (ListPage.test.tsx lines 1-11):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ListPage from './ListPage'
import { supabase } from '@/lib/supabase'
```
Use `MemoryRouter + Routes + Route` (not `BrowserRouter`) for page tests. Import component from `./InvitePage`.

**`supabase` mock pattern** (ListPage.test.tsx lines 47-93) — mock `@/lib/supabase` module, wire chainable methods. For InvitePage, only `rpc` is needed:
```typescript
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))
```
Cast with `vi.mocked(supabase.rpc)` inside tests to control resolved values.

**`renderAtRoute` helper pattern** (ListPage.test.tsx lines 108-117):
```typescript
function renderAtRoute(code: string) {
  return render(
    <MemoryRouter initialEntries={[`/invite/${code}`]}>
      <Routes>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/list/:code" element={<div>List Page</div>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
```
Include stub routes for navigation targets (`/list/:code`, `/`) so `navigate()` calls resolve without errors.

**`beforeEach` pattern** (ListPage.test.tsx lines 120-125):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

**Test scenarios for InvitePage** (from RESEARCH.md Validation Architecture):
1. Renders spinner before RPC resolves (check `.animate-spin` element)
2. On valid RPC response `{ share_code: 'ABC12345' }` → navigates to `/list/ABC12345`
3. On RPC returning `null` data → renders invalid-invite text
4. On RPC returning error → renders invalid-invite text
5. `navigate` is called with `{ replace: true }` on success

**`waitFor` pattern** (ListPage.test.tsx lines 141-143):
```typescript
await waitFor(() => {
  expect(screen.getByText('...')).toBeTruthy()
})
```

---

### `src/components/ShareBanner.test.tsx` (test, modify)

**Analog:** `src/components/ShareBanner.test.tsx` (self — the existing file is the pattern)

**Existing test structure** (ShareBanner.test.tsx lines 1-81): file is already well-structured with clipboard mock in `beforeEach`, `DEFAULT_PROPS` constant, and isolated `describe` block.

**Change needed:** The existing test at line 42 asserts `stringContaining('ABC12345')` on clipboard output. That test currently passes because the URL contains the code. After the D-05 change (line 14 of ShareBanner), the URL becomes `/invite/ABC12345` — the test still passes (code is still in the string).

**Add one new assertion** to the existing "Copy link" test to explicitly confirm `/invite/` prefix:
```typescript
expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
  expect.stringContaining('/invite/ABC12345'),
)
```
This pins the new behavior: the string must contain `/invite/` not `/list/`.

No other test file changes needed — dismiss, share button presence/absence tests are unaffected by the URL change.

---

## Shared Patterns

### `(select auth.uid())` initPlan optimization
**Source:** `supabase/migrations/lists_auth.sql` lines 31-36, `supabase/migrations/items_auth.sql` lines 34-38
**Apply to:** All new SQL policy USING and WITH CHECK clauses
```sql
-- Use subselect form, not bare auth.uid()
(select auth.uid()) = owner_id
-- NOT: auth.uid() = owner_id
```

### `DROP POLICY IF EXISTS` idempotency
**Source:** `supabase/migrations/lists_auth.sql` lines 19-23
**Apply to:** Every policy in `lists_membership.sql` and `items_membership.sql`
```sql
DROP POLICY IF EXISTS "policy_name" ON public.table_name;
```
Must precede every `CREATE POLICY` — no exceptions.

### `SECURITY DEFINER` + `SET search_path = ''` + `GRANT EXECUTE`
**Source:** RESEARCH.md Patterns 1, 5 (no codebase analog exists yet)
**Apply to:** Both `is_list_member` and `redeem_invite` functions
```sql
SECURITY DEFINER
SET search_path = ''
-- ... followed by:
GRANT EXECUTE ON FUNCTION public.fn_name(...) TO authenticated;
```
`SET search_path = ''` prevents schema injection. `GRANT EXECUTE TO authenticated` blocks anon role.

### `@/` import alias
**Source:** `src/pages/ListPage.tsx` lines 4-17, `src/stores/listsStore.ts` lines 1-4
**Apply to:** All new `.tsx` files
```typescript
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
```
Never use relative `../../` paths from pages or stores.

### Spinner markup
**Source:** `src/components/auth/ProtectedRoute.tsx` lines 10-16
**Apply to:** `src/pages/InvitePage.tsx` loading state
```typescript
<div className="min-h-screen flex items-center justify-center">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
</div>
```

### Vitest mock + `MemoryRouter` test scaffold
**Source:** `src/pages/ListPage.test.tsx` lines 1-117
**Apply to:** `src/pages/InvitePage.test.tsx`
- `vi.mock('@/lib/supabase', ...)` for supabase mock
- `MemoryRouter + initialEntries + Routes + Route` for routing
- `vi.clearAllMocks()` in `beforeEach`
- `waitFor` for async assertions

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/pages/`, `src/components/`, `src/stores/`, `src/router.tsx`
**Files scanned:** 10 source files + 2 test files
**Pattern extraction date:** 2026-05-30
