# Phase 10: List Sharing - Research

**Researched:** 2026-05-30
**Domain:** Supabase RLS membership model, SECURITY DEFINER RPC, react-router-dom v7 route patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `list_members` join table: `(list_id uuid REFERENCES lists(id) ON DELETE CASCADE, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now(), PRIMARY KEY (list_id, user_id))`. Composite PK gives idempotency.
- **D-02:** Access = list owner OR row in `list_members`. Rewrite `lists` and `items` RLS (new migration; keep existing files; add `list_members.sql` + policy-rewrite migration — idempotent `DROP POLICY IF EXISTS`). `items` SELECT widens from "own items only" to "all items whose `list_id` is accessible". `lists` SELECT/UPDATE/DELETE widen to owner-OR-member (retain `owner_id IS NULL` legacy branch). Keep `(select auth.uid())` initPlan pattern. Avoid RLS recursion via `SECURITY DEFINER` helper or equivalent non-recursive `EXISTS`.
- **D-03:** Dedicated protected route `/invite/:code`. On mount (user authenticated), calls redeem RPC, then redirects to `/list/:code`.
- **D-04:** Join via `redeem_invite(p_share_code text)` `SECURITY DEFINER` function. Find list by `share_code`; `INSERT INTO list_members … ON CONFLICT DO NOTHING`; return `share_code`/`id`. Idempotent. Unknown code → null → brief "invalid invite" state + link home.
- **D-05:** Repoint `ShareBanner` (`src/components/ShareBanner.tsx:14`) from `/list/${listCode}` to `/invite/${listCode}`.
- **D-06:** No new auth-gate logic. `/invite/:code` uses existing `ProtectedRoute` which stores `returnTo`.
- **D-07:** Idempotency at two layers: composite PK + `ON CONFLICT DO NOTHING`. `share_code` is fixed at creation (nanoid(8)).
- **D-08:** `listsStore.fetchLists` drops `.eq('owner_id', userId)` filter; relies on owner-OR-member RLS to return all accessible lists.
- **D-09:** Defer `profiles` table. Partner items render via Phase 9 D-06 attribution fallback (`added_by` + colored initials).

### Claude's Discretion
- Exact non-recursive membership-check shape (`SECURITY DEFINER is_list_member()` vs inline `EXISTS`)
- Whether `redeem_invite` returns `share_code` or list `id` for post-join redirect
- `/invite/:code` UX while joining (spinner) and invalid-invite copy
- Whether owner is also written as `list_members` row at creation (uniform membership) vs owner-only via `owner_id`
- `fetchLists`: pure RLS reliance vs explicit `.or()` query
- Realtime: confirm members receive item realtime events once items SELECT widens

### Deferred Ideas (OUT OF SCOPE)
- `profiles` table for live cross-user name/avatar
- Membership management (leave, remove, revoke/rotate invite, expiry, >2 members, roles)
- Non-link invites (email/SMS)
- Claim legacy anonymous (`owner_id IS NULL`) lists
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHARE-01 | User can generate a shareable invite link for a list | `redeem_invite` SECURITY DEFINER RPC (D-04) + `list_members` table (D-01) enable stable invite link. `share_code` already minted at `createList`. `ShareBanner` already builds + shares the link (one-line repoint per D-05). |
| SHARE-02 | User can access the invite link from a share button in the list header | `ShareBanner` already rendered in `ListPage` header (lines 296–302) and dismissed/re-expanded (D-11). Only D-05 URL repoint required. New `/invite/:code` route (D-03) handles redemption. |
</phase_requirements>

---

## Summary

Phase 10 is primarily a **database migration + one new route** problem, not a UI problem. The ShareBanner already exists and already has a share button; SHARE-02 is satisfied by a one-line URL repoint. The hard work is four SQL artifacts that must be written in the correct dependency order: (1) `list_members` table, (2) the `is_list_member` SECURITY DEFINER helper, (3) rewritten `lists`/`items` policies calling that helper, and (4) the `redeem_invite` SECURITY DEFINER RPC.

The central correctness risk is **RLS recursion**. If `lists` policies check `list_members` rows, and `list_members` policies check `lists` rows, Postgres throws `ERROR 42P17: infinite recursion detected in policy`. The canonical cure — confirmed by multiple verified sources — is a `SECURITY DEFINER` function that reads `list_members` **without triggering `list_members`'s own RLS** (because it runs as the function owner, bypassing RLS). `auth.uid()` is available inside such a function when invoked via PostgREST RPC because PostgREST sets the `request.jwt.claims` context before calling the function, and Supabase's `auth.uid()` helper reads that context. [VERIFIED: Supabase community discussion + RLS docs]

The Realtime path is the simplest part: once items SELECT RLS widens to include members, members automatically receive `postgres_changes` events because Supabase Realtime checks SELECT RLS per-event before broadcasting. The existing `realtime.setAuth` in `authStore.ts` (line 41) already supplies the member's JWT to the channel — no new realtime code needed.

The `returnTo` flow (D-06) works without any new code: `ProtectedRoute.tsx` stores `returnTo = /invite/:code` in sessionStorage (line 20), then `LandingPage.tsx` reads it at lines 46–54 and `navigate(returnTo)` after OAuth completes — the invite URL survives the round-trip intact.

**Primary recommendation:** Write migrations in three files: `list_members.sql` (table + `is_list_member` helper + `list_members` policies), `lists_membership.sql` (widened lists policies), `items_membership.sql` (widened items policies + `redeem_invite` function). Ship `InvitePage.tsx` as a thin mount-effect + redirect.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Membership storage | Database / Storage | — | `list_members` table with composite PK constraint |
| Membership-check logic | Database / Storage | — | `is_list_member` SECURITY DEFINER function evaluated at query time |
| Invite redemption | Database / Storage | API / Backend | `redeem_invite` SECURITY DEFINER bypasses RLS; PostgREST RPC is the bridge |
| Access enforcement | Database / Storage | — | RLS policies on `lists` + `items`; client never enforces access |
| Invite link construction | Browser / Client | — | `ShareBanner` constructs from `window.location.origin` + `listCode` |
| Post-OAuth route restoration | Browser / Client | — | `LandingPage.tsx` returnTo sessionStorage pattern already in place |
| Realtime events for members | Database / Storage | Browser / Client | RLS SELECT gate → Supabase Realtime broadcast; `setAuth` in authStore provides JWT |

---

## Standard Stack

No new packages. This phase is migrations + one new React page. All required libraries are already installed.

| Already Installed | Version | Use in Phase 10 |
|-------------------|---------|-----------------|
| `@supabase/supabase-js` | 2.106.1 | `supabase.rpc('redeem_invite', ...)`, RLS, Realtime |
| `react-router-dom` | 7.15.1 (installed) | `/invite/:code` route, `useNavigate`, `useParams` |
| `react` | 19.2.6 | `InvitePage.tsx` component |
| `lucide-react` | 1.16.0 | Spinner or existing icons in InvitePage |

**No npm install step for this phase.**

---

## Package Legitimacy Audit

> No new packages are installed in this phase. Audit section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
Partner opens /invite/:code
        |
        v
ProtectedRoute (existing)
  user absent? --> store returnTo=/invite/:code --> redirect to /
                          |
                   OAuth round-trip
                          |
                   LandingPage useEffect
                   reads returnTo --> navigate(/invite/:code)
        |
        v
InvitePage (new)
  useEffect on mount:
    supabase.rpc('redeem_invite', { p_share_code: code })
      |
      +--> SECURITY DEFINER fn (DB, no RLS)
      |    SELECT id FROM lists WHERE share_code = p_share_code
      |    INSERT INTO list_members (list_id, user_id) ON CONFLICT DO NOTHING
      |    RETURN share_code
      |
      +--> null? --> show "Invalid invite" + link home
      |
      +--> ok? --> navigate('/list/:share_code', { replace: true })
                          |
                          v
                   ListPage (existing)
                   RLS now admits member --> fetchList succeeds
                   subscribeToList --> items_changes filter: list_id=eq.X
                   RLS items SELECT allows member --> realtime events flow
```

### Recommended Project Structure

```
supabase/migrations/
├── lists_auth.sql           # EXISTING — untouched
├── items_auth.sql           # EXISTING — untouched
├── list_members.sql         # NEW — table + is_list_member helper + list_members policies
├── lists_membership.sql     # NEW — DROP + recreate lists policies (owner OR member)
└── items_membership.sql     # NEW — DROP + recreate items policies + redeem_invite fn

src/pages/
└── InvitePage.tsx           # NEW — mount-effect redeem RPC + redirect
src/router.tsx               # MODIFY — add /invite/:code route
src/components/ShareBanner.tsx  # MODIFY — line 14 only (/list/ → /invite/)
src/stores/listsStore.ts     # MODIFY — fetchLists: drop .eq('owner_id') filter
```

### Pattern 1: `is_list_member` SECURITY DEFINER Helper

**What:** A `SECURITY DEFINER` function that checks membership without triggering `list_members`'s own RLS policies, breaking the recursion cycle.

**When to use:** Called from `USING` clauses of `lists` and `items` policies. Must NOT be called from `list_members`'s own policies (that would recurse differently — list_members policies must use a direct `user_id = (select auth.uid())` check that doesn't re-read list_members via RLS).

**Example:**
```sql
-- Source: Supabase RLS docs + SECURITY DEFINER pattern (dev.to/kanta13jp1 + supabase discussions)
-- Reads list_members WITHOUT triggering list_members' own RLS (runs as owner/postgres role).
-- auth.uid() is available: PostgREST sets request.jwt.claims context before the call.
-- STABLE: read-only, result can be cached per statement.
-- search_path = '': forces explicit schema qualification, prevents search_path injection.
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

**Why SECURITY DEFINER breaks the recursion:**
- `lists` policy calls `is_list_member(list_id)` → reads `public.list_members` directly (no RLS, runs as function owner)
- `list_members` policy does NOT call any function that reads `lists` — it uses only `user_id = (select auth.uid())` and a direct `owner_id` check on `lists` via a subquery, but this creates the same recursion risk
- **Safest approach:** `list_members` SELECT policy checks `user_id = (select auth.uid())` only — no cross-table join needed for the user to read their own membership rows

### Pattern 2: Rewritten `lists` Policies (owner OR member)

```sql
-- Source: Derived from existing lists_auth.sql pattern + is_list_member helper
-- Keep legacy owner_id IS NULL branch for anonymous lists (carries forward from Phase 6)
-- Drop old policies first (idempotent, matching prior migration style)

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
-- Note: DELETE stays owner-only — a member should not be able to delete the list.
-- INSERT is not widened — only owner creates lists.
```

### Pattern 3: Rewritten `items` Policies (all items on accessible lists)

**The keystone change.** Items SELECT widens from "my own items" to "all items whose `list_id` belongs to a list I own or am a member of".

```sql
-- Source: Derived from items_auth.sql + is_list_member helper
-- items.list_id is the FK that connects items to lists.
-- The subquery checks ownership first (fast path), then membership.

DROP POLICY IF EXISTS "items_select" ON public.items;
CREATE POLICY "items_select" ON public.items FOR SELECT
  TO anon, authenticated
  USING (
    -- Legacy: unowned items (v1.0 anonymous phase)
    list_id IN (
      SELECT id FROM public.lists WHERE owner_id IS NULL
    )
    -- Owner of the list can see all items
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
    -- Member of the list can see all items
    OR public.is_list_member(list_id)
  );

DROP POLICY IF EXISTS "items_insert" ON public.items;
CREATE POLICY "items_insert" ON public.items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    list_id IN (
      SELECT id FROM public.lists WHERE owner_id IS NULL
    )
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
    OR public.is_list_member(list_id)
  );

DROP POLICY IF EXISTS "items_update" ON public.items;
CREATE POLICY "items_update" ON public.items FOR UPDATE
  TO anon, authenticated
  USING (
    list_id IN (
      SELECT id FROM public.lists WHERE owner_id IS NULL
    )
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
    OR public.is_list_member(list_id)
  )
  WITH CHECK (
    list_id IN (
      SELECT id FROM public.lists WHERE owner_id IS NULL
    )
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
    OR public.is_list_member(list_id)
  );

DROP POLICY IF EXISTS "items_delete" ON public.items;
CREATE POLICY "items_delete" ON public.items FOR DELETE
  TO anon, authenticated
  USING (
    list_id IN (
      SELECT id FROM public.lists WHERE owner_id IS NULL
    )
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
    OR public.is_list_member(list_id)
  );
```

### Pattern 4: `list_members` Table + Its Own Policies

```sql
-- list_members table (D-01)
CREATE TABLE IF NOT EXISTS public.list_members (
  list_id    uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);

ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

-- A user reads only their own membership rows (no cross-table check → no recursion risk)
CREATE POLICY "list_members_select" ON public.list_members FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Direct INSERT is closed — all inserts go through redeem_invite SECURITY DEFINER fn
-- (No INSERT policy → INSERT is denied for anon/authenticated roles)

-- Owner can view all members of their list (needed for future member management)
CREATE POLICY "list_members_owner_select" ON public.list_members FOR SELECT
  TO authenticated
  USING (
    list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
  );
```

**Note on list_members SELECT:** Having two SELECT policies with the same name is a Postgres error. Use distinct names (`list_members_self_select` and `list_members_owner_select`), or combine into a single policy using OR:

```sql
CREATE POLICY "list_members_select" ON public.list_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
  );
```

### Pattern 5: `redeem_invite` SECURITY DEFINER Function (D-04)

**What:** Bypasses RLS to look up the list by `share_code` (a non-member cannot SELECT the list row), then inserts into `list_members`. Idempotent via `ON CONFLICT DO NOTHING`.

**`auth.uid()` is available inside:** PostgREST injects the `request.jwt.claims` context before executing the function. Supabase's `auth.uid()` helper reads `current_setting('request.jwt.claims', true)`. The SECURITY DEFINER mechanism changes privilege level (bypasses RLS), not the session context — so JWT claims remain accessible. [VERIFIED: Supabase community discussion #3269, RLS docs]

```sql
-- Source: Supabase SECURITY DEFINER function docs + invite system patterns (boardshape.com)
CREATE OR REPLACE FUNCTION public.redeem_invite(p_share_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list_id   uuid;
  v_share_code text;
BEGIN
  -- Bypasses RLS: look up list by share_code even if caller is not yet a member
  SELECT id, share_code
    INTO v_list_id, v_share_code
  FROM public.lists
  WHERE share_code = p_share_code
  LIMIT 1;

  -- Unknown share_code: return null so the caller can show "invalid invite"
  IF v_list_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Idempotent: composite PK + ON CONFLICT DO NOTHING means re-redeeming is a no-op
  INSERT INTO public.list_members (list_id, user_id)
  VALUES (v_list_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'list_id',    v_list_id,
    'share_code', v_share_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
```

**Calling from supabase-js:**
```typescript
// Source: Supabase JavaScript docs + boardshape.com pattern
const { data, error } = await supabase.rpc('redeem_invite', { p_share_code: code })
// data is null (unknown code) or { list_id: '...', share_code: '...' }
// error is a PostgREST error (e.g., DB-level failure)
```

**Return shape decision (Claude's Discretion):** Return both `list_id` and `share_code`. The redirect needs `share_code` for `/list/:code`. Including `list_id` lets future code avoid a second lookup.

### Pattern 6: InvitePage Component (D-03)

**Idiomatic v7 pattern:** A component with a single `useEffect` on mount. No loader (loaders run before auth in v7 file-based routing, but this project uses `createBrowserRouter` with a manual component — a loader would run before `ProtectedRoute` can gate it). Use `useEffect` + `useNavigate`.

```typescript
// Source: react-router-dom v7 docs + existing ListPage pattern
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!code) { navigate('/'); return }

    supabase.rpc('redeem_invite', { p_share_code: code }).then(({ data, error }) => {
      if (error || !data) {
        setInvalid(true)
      } else {
        navigate(`/list/${data.share_code}`, { replace: true })
      }
    })
  }, [code, navigate])

  if (invalid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-sm text-muted-foreground">This invite link is invalid or has expired.</p>
        <a href="/" className="text-sm text-blue-600 underline">Back to home</a>
      </div>
    )
  }

  // Spinner while redeeming
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}
```

**Router registration (`router.tsx`):**
```typescript
// /invite/:code is a protected route (user must be logged in to redeem)
// It sits inside ProtectedRoute but does NOT need AppShell (no sidebar)
{
  element: <ProtectedRoute />,
  children: [
    {
      element: <AppShell />,
      children: [
        { path: '/list/:code', element: <ListPage /> },
      ],
    },
    // InvitePage outside AppShell — full-screen spinner, no sidebar needed
    { path: '/invite/:code', element: <InvitePage /> },
  ],
},
```

### Pattern 7: `fetchLists` — Drop the `owner_id` filter (D-08)

**Current code (`listsStore.ts` lines 25–29):**
```typescript
const { data, error } = await supabase
  .from('lists')
  .select('id, name, share_code, owner_id, created_at')
  .eq('owner_id', userId)          // <-- DROP THIS LINE
  .order('created_at', { ascending: false })
```

**After change:** `.eq('owner_id', userId)` removed. RLS `lists_select` policy now returns owned lists AND member lists. No explicit `.or()` needed — RLS alone suffices.

**Signature impact:** `fetchLists(userId: string)` — the `userId` parameter becomes unused once the filter is dropped. It can be kept for API compatibility or removed; either is safe. If removed, callers (LandingPage, AppShell) need updating.

**Recommendation (Claude's Discretion):** Keep the parameter signature but stop using it in the query body. Avoids cascading caller changes.

### Anti-Patterns to Avoid

- **RLS on `list_members` that checks `lists` table via a subquery:** If `list_members` SELECT checks `lists.owner_id`, and `lists` SELECT checks `list_members` via `is_list_member`, Postgres will recurse. Keep `list_members` policies simple — `user_id = (select auth.uid())` only.
- **Calling `is_list_member` from inside `list_members` policies:** That would make the helper self-recursive (reads `list_members` → triggers `list_members` policy → calls helper → reads `list_members` → ...). The helper is only called from `lists` and `items` policies.
- **Inline EXISTS subquery on `list_members` in `items` policies (without SECURITY DEFINER):** e.g., `EXISTS (SELECT 1 FROM list_members WHERE list_id = items.list_id AND user_id = auth.uid())` — this works only if `list_members` has no RLS, or if the policy on `list_members` is permissive enough. With RLS on `list_members`, this may return zero rows for a valid member because the `items` policy evaluation context triggers `list_members` RLS. The SECURITY DEFINER helper is the robust solution.
- **Using `navigator.share` / clipboard inside `useEffect` (non-gesture context):** Share and clipboard APIs require a user gesture. The existing `ShareBanner` correctly places them in `onClick` handlers — do not move them into effects.
- **`owner_id` filter removal breaking `userId` param:** `fetchLists(userId)` is called from `LandingPage` (line 59) and likely AppShell. Removing the filter silently changes what data returns — no type error, just behavior change. This is correct and intentional.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RLS recursion prevention | Custom middleware / application-level membership check | `SECURITY DEFINER` SQL function | Database-level; no round-trips; proven Supabase pattern |
| Idempotent membership insertion | Application-level duplicate check before INSERT | `ON CONFLICT DO NOTHING` on composite PK | Atomic; immune to race conditions; zero extra queries |
| Invite link generation | UUID/token table, expiry, rotation logic | Fixed `share_code` (already minted as nanoid(8) at list creation) | Simplest possible; idempotency falls from PK; no expiry needed for household use |
| Cross-table access check | Application-level query then check | RLS policy + `is_list_member` helper | Single source of truth; enforced at DB layer regardless of client |
| Post-OAuth path restoration | Custom localStorage + redirect logic | Existing `returnTo` sessionStorage in `ProtectedRoute` + `LandingPage` | Already implemented and tested; adding new logic would duplicate it |

**Key insight:** The RLS layer is the access boundary. Every application-level check that duplicates RLS is a liability — it can drift out of sync with the policy. Trust the policy.

---

## Realtime for Members — Verification

**Q: Does widening items SELECT RLS automatically allow a member to receive realtime item events?**

**A: Yes.** [VERIFIED: Supabase Realtime Postgres Changes docs]

Supabase Realtime checks RLS SELECT policies per-event before broadcasting to a subscriber. The subscriber's JWT (set via `realtime.setAuth`) is used to evaluate the policy. Once `items_select` admits a member for a given `list_id`, that member's channel will receive INSERT/UPDATE/DELETE events for items in that list.

**Existing setup that makes this work automatically:**
- `authStore.ts` line 41: `supabase.realtime.setAuth(session.access_token)` — called on every auth state change, including after OAuth sign-in. The member's JWT is active on the realtime connection.
- `itemsStore.ts` lines 247–252: channel subscribed with `filter: list_id=eq.${listId}` — this filter narrows by list, then RLS further gates by membership.
- No `subscribeToList` code changes needed.

**The single prerequisite:** The `items_select` policy must be widened (D-02) before realtime events flow to members. That is the migration task.

---

## `returnTo` Flow — Verification

The complete unauthenticated-partner invite flow:

1. Partner opens `https://our-cart.app/invite/ABC12345` (not authenticated)
2. `ProtectedRoute.tsx` line 20: `sessionStorage.setItem('returnTo', '/invite/ABC12345')` → redirects to `/`
3. `LandingPage.tsx` renders the login page (not authenticated)
4. Partner clicks "Sign in with Google" → `authStore.signInWithGoogle()` → `supabase.auth.signInWithOAuth({ options: { redirectTo: window.location.origin } })`
5. OAuth redirects back to `window.location.origin` (e.g., `https://our-cart.app/`)
6. `onAuthStateChange` fires → `authStore` sets `user`, `session`; `realtime.setAuth` called
7. `LandingPage.tsx` `useEffect([user])` at lines 46–54: reads `returnTo = '/invite/ABC12345'`, calls `navigate('/invite/ABC12345', { replace: true })`
8. `InvitePage` renders → `useEffect` calls `redeem_invite` → navigates to `/list/ABC12345`

**Critical finding:** `returnTo` is consumed in **`LandingPage.tsx`** (lines 46–54), NOT in the router or a separate callback. This means the flow works correctly as long as `/invite/:code` resolves through `ProtectedRoute` which redirects to `/` (LandingPage) on unauthenticated access. [VERIFIED: codebase read]

**Edge case — already-authenticated partner:** If the partner is already signed in when they open `/invite/:code`, `ProtectedRoute` passes them through directly to `InvitePage`. No `returnTo` needed. The `useEffect` runs immediately.

---

## D-09 Fallback Confirmation

Partner items (items with `added_by = 'Partner Name'` and `user_id = partner_uuid`) already render correctly with zero attribution work needed. [VERIFIED: codebase read]

- `src/lib/attribution.ts`: `getAttributionColor(name)` and `getInitials(name)` are deterministic from the `added_by` string — no user lookup needed.
- `src/types/item.ts` `Item.added_by: string | null` — the frozen name stored at insert time.
- `resolveDisplayName(user)` in `ListPage.tsx` (lines 256–263) is called for the CURRENT user only (to populate `addedBy` on new items). Partner items already have their `added_by` string from when they were inserted.
- Once `items_select` RLS widens (D-02), partner items return from the query. Attribution display requires no changes — the badge renders from `item.added_by`.

---

## Common Pitfalls

### Pitfall 1: RLS Recursion on `list_members`
**What goes wrong:** Writing `list_members` SELECT policy as `EXISTS (SELECT 1 FROM lists WHERE id = list_members.list_id AND owner_id = auth.uid())` while `lists` SELECT policy calls `is_list_member()`. Postgres detects the cycle: `lists` → `list_members` (via helper) → `lists` (via list_members policy subquery) → infinite recursion.
**Why it happens:** Both tables' policies reference each other.
**How to avoid:** `list_members` SELECT policy uses ONLY `user_id = (select auth.uid())` (and optionally an owner check via a direct `lists.owner_id` subquery — which is safe because `lists` SELECT RLS is not triggered inside a SECURITY DEFINER context). Alternatively, put the owner-read-all-members policy check in a SECURITY DEFINER function too.
**Warning signs:** `ERROR: 42P17: infinite recursion detected in policy for relation "list_members"` or `...for relation "lists"` when querying either table.

### Pitfall 2: `is_list_member` Called from `list_members` Policies
**What goes wrong:** Reusing `is_list_member` in `list_members`'s own policies. The helper reads `list_members` (bypassing its own RLS), but if `list_members` policies call the helper, and the helper reads `list_members`, there's a direct self-reference loop.
**How to avoid:** `list_members` policies must not call `is_list_member`. Keep them to direct column checks.

### Pitfall 3: `fetchLists` Filter Removal Silently Returns More Data
**What goes wrong:** Dropping `.eq('owner_id', userId)` returns all RLS-accessible lists (owned + member). If RLS is not yet deployed when the store code is deployed, the filter removal has no effect. Conversely, if RLS is deployed first without the store change, the sidebar still shows only owned lists.
**How to avoid:** Deploy migration and store change together (same plan wave, or migration first + store immediately after).

### Pitfall 4: `owner_id` Filter on `items` Policies
**What goes wrong:** The Phase 6 `items_insert` policy uses `WITH CHECK (user_id IS NULL OR (select auth.uid()) = user_id)` — this checks the ITEM's `user_id`, not the list's membership. It continues to work correctly for members because a member inserting an item will have `user_id = auth.uid()` (the default on the items table). No change needed here.
**Why it happens:** The items policy checks item ownership, not list membership — only the SELECT (and UPDATE/DELETE) need the list membership check.
**Warning signs:** None — this works. But misreading it as "needs to be widened like SELECT" would create an unnecessarily permissive INSERT policy.

### Pitfall 5: `redeem_invite` Returns No Row for Self-Redeem
**What goes wrong:** The owner opens their own invite link. `INSERT ... ON CONFLICT DO NOTHING` inserts nothing (owner is not in `list_members`). The function returns the share_code correctly. But if the function returns NULL on "no insert," the UI would wrongly show "invalid invite."
**How to avoid:** The function finds the list by `share_code` first, then attempts the insert. It returns the share_code regardless of whether the insert succeeds or is a no-op. The return value signals "list found" — not "insert happened."

### Pitfall 6: `InvitePage` outside `AppShell` in Router
**What goes wrong:** Putting `/invite/:code` inside the `AppShell` wrapper causes the sidebar to render during the join flow — confusing UX (partner sees an empty sidebar while being redirected).
**How to avoid:** `/invite/:code` sits inside `ProtectedRoute` but outside `AppShell` (see router pattern above).

### Pitfall 7: Realtime Not Flowing After Join Until Page Reload
**What goes wrong:** The partner redeems the invite, lands on `/list/:code`, but `subscribeToList` opened before membership was recorded — the channel was already subscribed with the pre-join JWT.
**Why:** `realtime.setAuth` was called at login (JWT hasn't changed), and the channel was opened before the membership row existed. Supabase Realtime re-evaluates RLS on each event, not at subscription time — so the membership INSERT mid-session is picked up automatically for subsequent events. But `fetchItems` on subscribe runs before the membership INSERT (race if subscribe fires synchronously).
**How to avoid:** `InvitePage` calls `redeem_invite` (DB insert) before navigating. `ListPage` calls `subscribeToList` in a `useEffect([list])` after `list` is loaded. By the time `subscribeToList` runs on the redirected `/list/:code`, the membership row already exists. No race in normal flow. Document this dependency explicitly.

---

## Code Examples

### Complete `list_members.sql` Migration Structure

```sql
-- Phase 10: List membership table + is_list_member helper + list_members policies
-- Dependencies: lists table (Phase 6), auth.users (Supabase built-in)
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS

-- 1. Table
CREATE TABLE IF NOT EXISTS public.list_members (
  list_id    uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);

ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

-- 2. SECURITY DEFINER helper (must exist before policies that use it)
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

-- 3. list_members RLS policies (simple — no cross-table reference)
DROP POLICY IF EXISTS "list_members_select" ON public.list_members;
CREATE POLICY "list_members_select" ON public.list_members FOR SELECT
  TO authenticated
  USING (
    -- Own membership rows
    user_id = (select auth.uid())
    -- OR owner of the list (for future member management UI)
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
  );
-- No INSERT policy: direct inserts closed; only redeem_invite fn can insert
```

### Complete `redeem_invite` SQL

```sql
-- Phase 10: Invite redemption function
-- SECURITY DEFINER: bypasses RLS to find list by share_code for non-members
-- auth.uid() available: PostgREST injects JWT claims context before call
-- Idempotent: ON CONFLICT DO NOTHING on PK (list_id, user_id)
-- Returns: json { list_id, share_code } or NULL if code not found

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
  SELECT id, share_code
    INTO v_list_id, v_share_code
  FROM public.lists
  WHERE share_code = p_share_code
  LIMIT 1;

  IF v_list_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.list_members (list_id, user_id)
  VALUES (v_list_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'list_id',    v_list_id,
    'share_code', v_share_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
```

### `supabase.rpc` call + error handling

```typescript
// Source: Supabase JavaScript reference docs
const { data, error } = await supabase.rpc('redeem_invite', { p_share_code: code })
// data: null (unknown code) | { list_id: string, share_code: string }
// error: null | PostgrestError (e.g., auth not set, DB error)
if (error || !data) {
  setInvalid(true)
} else {
  navigate(`/list/${data.share_code}`, { replace: true })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Owner-only RLS (`owner_id = auth.uid()`) | Owner-OR-member RLS via `is_list_member` helper | Phase 10 | Partners can read all items on shared lists |
| `fetchLists` filtered by `owner_id` | `fetchLists` unfiltered (RLS returns all accessible) | Phase 10 | Member lists appear in partner's sidebar automatically |
| ShareBanner links to `/list/:code` | ShareBanner links to `/invite/:code` | Phase 10 | Visiting the link triggers membership join |

**Deprecated/outdated after Phase 10:**
- `items_select` policy `(user_id IS NULL OR auth.uid() = user_id)` — replaced by list-membership check
- `lists_select` policy `(owner_id IS NULL OR auth.uid() = owner_id)` — replaced by owner-OR-member
- `.eq('owner_id', userId)` in `listsStore.fetchLists` — removed, RLS replaces it

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `list_members` policies using only `user_id = auth.uid()` (no cross-table ref) do not trigger RLS recursion | Pitfall 1, Pattern 4 | If wrong, `list_members` SELECT itself would fail. Mitigation: test policy with simple self-row check first. |
| A2 | `auth.uid()` is available inside `redeem_invite` SECURITY DEFINER when called via PostgREST RPC | Pattern 5 | If wrong, `list_members` insert would use NULL user_id. Mitigation: return `auth.uid()` in function result for verification test. |
| A3 | Supabase Realtime re-evaluates RLS per-event using the subscriber's current JWT | Realtime section | If wrong, member may not receive events until re-subscribe. Mitigation: manual test with two browser tabs after redemption. |

**All other claims in this research were verified against the codebase or official Supabase documentation.**

---

## Open Questions

1. **Should the owner also be written as a `list_members` row at list creation? (Claude's Discretion)**
   - What we know: Owner access is already enforced via `owner_id = auth.uid()` in all policies, so a `list_members` row is redundant for the owner.
   - What's unclear: Future member-management UI might benefit from uniform membership rows (easier "list all members" query).
   - Recommendation: Do NOT add owner to `list_members` at creation. Keeps the model clean: `owner_id` = owner, `list_members` = additional members. Easier to reason about. `is_list_member()` only needs to check for non-owner members.

2. **Migration execution order when Supabase applies migrations**
   - What we know: Supabase applies migrations in filename alphabetical order.
   - What's unclear: The helper function `is_list_member` must exist before `lists_membership.sql` and `items_membership.sql` reference it.
   - Recommendation: Name migrations so `list_members.sql` sorts before `lists_membership.sql` and `items_membership.sql`. e.g., `list_members.sql` < `lists_membership.sql` < `items_membership.sql` alphabetically. Or use a single migration file.

---

## Environment Availability

Step 2.6: The phase is migrations + TypeScript component changes. No new CLI tools, services, or runtimes needed beyond what's already installed. Skipping detailed availability audit — existing Supabase project and development environment are confirmed operational (Phase 9 complete).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.3 |
| Config file | `vitest.config.ts` (exists, jsdom environment, globals: true) |
| Setup file | `src/test-setup.ts` (exists) |
| Quick run command | `npx vitest run src/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-01 | `redeem_invite` RPC returns share_code for valid code | Integration (manual/Supabase) | Manual two-browser test | N/A |
| SHARE-01 | `redeem_invite` returns null for unknown code | Integration (manual/Supabase) | Manual | N/A |
| SHARE-01 | Re-redeeming same code is idempotent (no duplicate membership) | Integration (manual/Supabase) | Manual | N/A |
| SHARE-01 | Member can SELECT items on the shared list | Integration (manual/Supabase) | Manual | N/A |
| SHARE-01 | Non-member CANNOT SELECT items on another user's list | Integration (manual/Supabase) | Manual | N/A |
| SHARE-02 | ShareBanner copy button copies `/invite/` URL | Unit | `npx vitest run src/components/ShareBanner` | ❌ Wave 0 |
| SHARE-02 | InvitePage renders spinner then redirects on valid code | Unit | `npx vitest run src/pages/InvitePage` | ❌ Wave 0 |
| SHARE-02 | InvitePage shows invalid state on null return | Unit | `npx vitest run src/pages/InvitePage` | ❌ Wave 0 |

**RLS + Realtime tests are integration tests that require a live Supabase instance.** They cannot be automated in the Vitest jsdom environment. They become manual UAT items.

### Critical Test Scenarios (UAT-level)

| Scenario | Steps | Pass Condition |
|----------|-------|----------------|
| RLS: member reads items | User B redeems invite → query `items` with `list_id` filter | Returns all items (not empty/blocked) |
| RLS: non-member blocked | User C (not member, not owner) queries `items` with `list_id` | Returns empty array (RLS blocks) |
| Idempotent redeem | Same user redeems same code 3 times | Single `list_members` row; redirects to list each time |
| Owner self-redeem | Owner opens their own invite link | No-op insert; redirects to list |
| Realtime cross-user | User A adds item → User B (member, different tab) sees it | Item appears in User B's list within 2s |
| Unknown code | `/invite/NOTEXIST` | "Invalid invite" UI shown |
| Unauthenticated flow | Open `/invite/:code` → sign in → land on list | List loaded, items visible |

### Sampling Rate
- **Per task commit:** `npx vitest run src/` (unit tests only, < 5s)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + manual UAT table complete before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/pages/InvitePage.test.tsx` — covers SHARE-02 InvitePage behavior (mock supabase.rpc)
- [ ] `src/components/ShareBanner.test.tsx` — covers SHARE-02 URL construction (assert `/invite/` prefix)

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` per config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (existing auth) | — |
| V3 Session Management | No (existing session) | — |
| V4 Access Control | **Yes** | Supabase RLS policies (owner OR member); `SECURITY DEFINER` function with pinned `search_path` |
| V5 Input Validation | Partial | `p_share_code text` — no length limit currently; recommend `LIMIT 1` (already in SQL) + consider `char_length(p_share_code) <= 32` guard |
| V6 Cryptography | No | `share_code` uses existing nanoid(8) — URL-safe random, not a secret token |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass invite enumeration (brute-force short codes) | Information Disclosure | nanoid(8) = 64^8 ≈ 281 trillion combinations; no rate limit needed for household use. Note: acceptable at this scale, would need rate limiting for public app. |
| Unauthorized list access via share_code bypass | Tampering | `lists_select` RLS requires ownership OR membership — non-member cannot access even with the URL unless they redeem first |
| `redeem_invite` called without auth | Elevation of Privilege | `GRANT EXECUTE TO authenticated` only; `anon` role cannot call it; `auth.uid()` returns NULL for anon → INSERT would fail PK `NOT NULL` constraint |
| `search_path` injection in SECURITY DEFINER functions | Spoofing | `SET search_path = ''` on both `is_list_member` and `redeem_invite` mitigates schema injection [CITED: Supabase functions docs] |
| SECURITY DEFINER function called directly via REST API | Information Disclosure | Function is in `public` schema — accessible via PostgREST. Acceptable: it only returns data the caller would be entitled to after joining anyway. No secret data exposed. |

---

## Sources

### Primary (HIGH confidence)
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — SECURITY DEFINER pattern, `(select auth.uid())` optimization, recursion prevention
- [Supabase Functions docs](https://supabase.com/docs/guides/database/functions) — `SECURITY DEFINER`, `search_path`, `GRANT EXECUTE`, `supabase.rpc()` syntax
- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) — RLS per-event authorization, JWT/setAuth behavior
- Codebase: `ProtectedRoute.tsx`, `LandingPage.tsx`, `authStore.ts`, `listsStore.ts`, `itemsStore.ts`, `lists_auth.sql`, `items_auth.sql`, `ShareBanner.tsx`, `router.tsx`, `Item` and `List` types — all read directly [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- [boardshape.com RLS invite system](https://medium.com/@boardshape/how-to-implement-rls-for-a-team-invite-system-with-supabase-43dae74ecd36) — `get_teams_with_owner_privilege_for_authenticated_user()` pattern confirming `auth.uid()` in SECURITY DEFINER + `STABLE` + `SET search_path`
- [dev.to/kanta13jp1 — Supabase SECURITY DEFINER recursion prevention](https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2) — complete example of helper function + policy usage pattern
- [Supabase GitHub discussion #3269](https://github.com/orgs/supabase/discussions/3269) — confirms `auth.uid()` available in SECURITY DEFINER called via PostgREST

### Tertiary (LOW confidence — training knowledge, not independently verified this session)
- react-router-dom v7 `useParams` + `useNavigate` in functional components — behavior is consistent with v6 for component-based routing (no file-based loader needed). [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new packages; all existing
- SQL Migration Patterns: HIGH — verified against Supabase official docs + multiple community sources + existing migration style read directly
- `returnTo` / OAuth flow: HIGH — read actual `LandingPage.tsx` lines 46–54, `ProtectedRoute.tsx` lines 19–21, `authStore.ts` line 51
- Realtime for members: HIGH — Supabase Realtime docs confirm RLS SELECT gates events
- `auth.uid()` in SECURITY DEFINER: MEDIUM — confirmed via community discussion and secondary sources, not a single official doc page statement
- InvitePage router pattern: MEDIUM — derived from existing code patterns; react-router-dom v7 loader alternative not deeply researched (deemed unnecessary for this case)

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (Supabase RLS patterns are stable; react-router-dom v7 minor API is stable)
