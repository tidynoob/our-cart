---
phase: "06"
status: issues_found
severity_counts:
  critical: 2
  warning: 2
  info: 1
files_reviewed: 9
files_reviewed_list:
  - src/stores/authStore.ts
  - src/components/auth/ProtectedRoute.tsx
  - src/components/auth/LoginPage.tsx
  - src/pages/LandingPage.tsx
  - src/App.tsx
  - src/router.tsx
  - src/lib/supabase.ts
  - supabase/migrations/items_auth.sql
  - supabase/migrations/lists_auth.sql
depth: standard
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-28T02:30:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 06 adds Google OAuth authentication via Supabase Auth with a Zustand auth store, route protection, conditional landing page, and database migrations for user-scoped RLS. The client-side auth code (authStore, ProtectedRoute, App.tsx, LoginPage, LandingPage, router, supabase client config) is well-structured and follows the locked decisions from STATE.md correctly. The onAuthStateChange callback is synchronous, realtime.setAuth is called, PKCE is configured, and the isLoading guard prevents auth flash.

However, the database RLS migrations contain a critical logic error that will break the core app functionality (shared grocery list between two people), and the signInWithGoogle action is missing the required `redirectTo` option.

## Critical Issues

### CR-01: RLS policies on `items` table break shared list access for authenticated users

**File:** `supabase/migrations/items_auth.sql:33-66`
**Issue:** The SELECT, UPDATE, and DELETE policies use `user_id IS NULL OR (select auth.uid()) = user_id`. Combined with the `DEFAULT auth.uid()` on the `user_id` column (line 16), every new item inserted by an authenticated user gets `user_id = <that user's UID>`. When the partner (a different authenticated user) tries to read the shared list, the RLS policy blocks them because:
- `user_id IS NOT NULL` (fails first branch)
- `auth.uid() != user_id` since they are a different user (fails second branch)

This completely breaks the core value proposition of the app: "Two people can see the same grocery list update in real-time." After this migration ships, User A adds milk, User B cannot see it.

The same issue affects UPDATE and DELETE: User B cannot check off or remove items that User A added.

**Fix:** The RLS policies must also check list membership or scope access by `list_id`. Since the list-membership model does not yet exist (Phase 7), the interim fix should scope items access through the `lists` table. A simpler interim approach: remove the `user_id`-based restriction entirely and rely on `list_id` scoping (items are already scoped to a list that both users can access), or add a subquery that checks the user has access to the item's list:

```sql
-- Interim: keep list-level access control, not item-level user ownership
CREATE POLICY "items_select" ON items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = items.list_id
      AND (lists.owner_id IS NULL OR (select auth.uid()) = lists.owner_id)
    )
  );
```

Alternatively, if item-level user attribution is deferred to a future phase, simply use `true` as the USING clause (any authenticated user can read any item they can reach via list), since the app is not multi-tenant and has no public access concern. The key point: RLS on items must NOT prevent the partner from seeing items on their shared list.

### CR-02: `signInWithGoogle` missing `redirectTo` option -- OAuth may redirect to wrong URL

**File:** `src/stores/authStore.ts:50-54`
**Issue:** The `signInWithGoogle` action calls `supabase.auth.signInWithOAuth({ provider: 'google' })` without specifying `options.redirectTo`. The locked decision D-03/D-13 and the research doc (Pattern 1, line 269) both require `redirectTo: window.location.origin` to ensure the user returns to the correct app origin after OAuth. Without this, Supabase falls back to the Site URL configured in the Supabase Dashboard. If the Site URL is misconfigured (e.g., set to localhost in production, or vice versa), the OAuth flow will redirect to the wrong URL after authentication. Using `window.location.origin` makes it environment-agnostic.

**Fix:**
```typescript
signInWithGoogle: async () => {
  set({ error: null })
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) set({ error: error.message })
},
```

## Warnings

### WR-01: RLS policies on `lists` table will block partner access once `owner_id` is populated

**File:** `supabase/migrations/lists_auth.sql:30-56`
**Issue:** The lists SELECT policy uses `owner_id IS NULL OR (select auth.uid()) = owner_id`. This works now because all existing lists have `owner_id = NULL`. But in Phase 7, when lists get an `owner_id`, the partner user will be unable to see the shared list. This is an architectural time bomb -- the policy is correct for this phase but will break in the next phase if not revised.

This is classified as WARNING (not CRITICAL) because Phase 7 is expected to add a list-membership model that revises these policies. However, if the Phase 7 migration fails to update the SELECT policy before populating `owner_id`, the app breaks silently.

**Fix:** Document this dependency explicitly in a migration comment or add a TODO. Alternatively, preemptively add a `list_members` table or a column-based access pattern now. At minimum, the Phase 7 plan must be reviewed to confirm it replaces these policies.

### WR-02: `LoginPage` button click fires async function without error boundary

**File:** `src/components/auth/LoginPage.tsx:17`
**Issue:** The `Button`'s `onClick` handler calls `onSignIn()` which returns a `Promise<void>`. React's `onClick` expects a synchronous void handler. If the promise rejects for any reason NOT caught inside `signInWithGoogle` (e.g., a network error thrown before `supabase.auth.signInWithOAuth` is reached, or a future code change removes the internal catch), the rejection will be unhandled. While the current `signInWithGoogle` implementation does catch errors, the `LoginPage` component does not defend itself against uncaught rejections.

**Fix:** Wrap the onClick call to handle potential rejections:
```tsx
<Button onClick={() => { onSignIn().catch(() => {}) }} size="lg">
  Sign in with Google
</Button>
```

Or change the `LoginPage` to handle the promise explicitly with a loading state on the button.

## Info

### IN-01: `AuthChangeEvent` type imported but parameter is prefixed with underscore

**File:** `src/stores/authStore.ts:2,28`
**Issue:** `AuthChangeEvent` is imported on line 2 and used only for the `_event` parameter type on line 28. The underscore prefix signals "intentionally unused" but the type annotation is still applied, which means the import is not dead. This is fine, but worth noting that the `_event` parameter could be useful in the future for distinguishing between SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, and INITIAL_SESSION events (e.g., to avoid calling `setAuth(null)` on INITIAL_SESSION when no session exists, vs. calling it on SIGNED_OUT). Currently all events are treated identically.

**Fix:** No action required. The import is correctly used for type annotation. If event-specific logic is added later, remove the underscore prefix and add branching.

---

_Reviewed: 2026-05-28T02:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
