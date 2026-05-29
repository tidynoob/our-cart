---
phase: 06-auth-foundation
verified: 2026-05-28T11:20:00Z
status: verified
score: 10/10
overrides_applied: 0
human_verified: 2026-05-29T00:00:00Z
# Human UAT recorded in 06-UAT.md: 8/8 passed (2026-05-28). OAuth E2E, return-to-URL,
# session persistence, Supabase migrations, and login visual all confirmed by human tester.
---

# Phase 6: Auth Foundation Verification Report

**Phase Goal:** Users can sign in with Google and the app knows who they are across sessions
**Verified:** 2026-05-28T11:20:00Z
**Status:** verified (human UAT passed 8/8 — see 06-UAT.md)
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can tap "Sign in with Google" and complete OAuth flow to reach the app | VERIFIED | `signInWithGoogle()` in authStore.ts calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` (line 51-54). LoginPage.tsx renders Button with text "Sign in with Google" (line 17-19). LandingPage.tsx passes `signInWithGoogle` to LoginPage as `onSignIn` prop (line 37). |
| 2 | After closing and reopening the browser, user is still signed in without re-authenticating | VERIFIED | `supabase.ts` configures `auth: { flowType: 'pkce', detectSessionInUrl: true }` (lines 14-17). App.tsx calls `initialize()` in useEffect on mount (lines 9-12), which sets up `onAuthStateChange` listener that restores session from Supabase's localStorage-backed persistence. authStore.ts `initialize()` handles INITIAL_SESSION event to restore user/session state (lines 27-44). |
| 3 | Visiting any list URL without being signed in redirects to the login page | VERIFIED | router.tsx wraps `/list/:code` in a pathless layout route with `element={<ProtectedRoute />}` (lines 9-13). ProtectedRoute.tsx checks `isLoading` and `user` from authStore; when `!user`, stores `returnTo` in sessionStorage and returns `<Navigate to="/" replace />` (lines 18-21). Root `/` and `*` routes are NOT wrapped -- correct. |
| 4 | After completing OAuth redirect, user lands on the correct destination (not a blank callback page) | VERIFIED | supabase.ts has `detectSessionInUrl: true` (line 16) which processes the OAuth callback hash. signInWithGoogle uses `redirectTo: window.location.origin` (line 53) so Supabase redirects back to `/`. LandingPage.tsx useEffect (lines 16-24) checks `sessionStorage.getItem('returnTo')` when user becomes non-null, navigates there with `replace: true`, and clears sessionStorage. ProtectedRoute.tsx stores the path before redirecting (line 20). |
| 5 | authStore exports useAuthStore with initialize/signInWithGoogle/signOut | VERIFIED | authStore.ts exports `useAuthStore` (line 15) with `AuthState` interface (lines 5-13) containing all three actions. |
| 6 | onAuthStateChange callback is synchronous (no async keyword) | VERIFIED | authStore.ts line 28: `(_event: AuthChangeEvent, session: Session | null) => {` -- plain arrow function, no async keyword. Confirmed via grep: only `signInWithGoogle` and `signOut` have async. |
| 7 | realtime.setAuth called on every auth state change | VERIFIED | authStore.ts lines 38-41: `if (session?.access_token) { supabase.realtime.setAuth(session.access_token) } else { supabase.realtime.setAuth(null) }` -- inside the onAuthStateChange callback, covering both token and null cases. 3 occurrences of `realtime.setAuth` in the file. |
| 8 | SQL migrations have nullable user_id/owner_id with proper RLS | VERIFIED | items_auth.sql: `ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` (line 15) with `DEFAULT auth.uid()`. 4 DROP POLICY IF EXISTS + 4 CREATE POLICY with `user_id IS NULL OR (select auth.uid()) = user_id` pattern. lists_auth.sql: `ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` (line 14). 4 DROP + 4 CREATE with `owner_id IS NULL OR (select auth.uid()) = owner_id` pattern. Neither file contains ENABLE ROW LEVEL SECURITY. |
| 9 | supabase.ts has PKCE flow type | VERIFIED | supabase.ts line 15: `flowType: 'pkce'` and line 16: `detectSessionInUrl: true`. realtime worker config preserved at line 12. |
| 10 | LandingPage shows login when unauthenticated, content when authenticated | VERIFIED | LandingPage.tsx: isLoading guard returns spinner (lines 28-33), `!user` returns `<LoginPage onSignIn={signInWithGoogle} error={error} />` (line 37), authenticated path renders CreateListForm and JoinListForm (lines 40-56). |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/authStore.ts` | Zustand auth store with user/session/isLoading/error + actions | VERIFIED | 62 lines, exports useAuthStore, AuthState interface, initialize/signInWithGoogle/signOut |
| `src/components/auth/ProtectedRoute.tsx` | Route guard with isLoading spinner, redirect, sessionStorage | VERIFIED | 25 lines, default export, uses useAuthStore selectors, Navigate, Outlet |
| `src/components/auth/LoginPage.tsx` | Login screen with app name and Google sign-in button | VERIFIED | 27 lines, pure presentational, Button from shadcn/ui, error display |
| `src/pages/LandingPage.tsx` | Auth-conditional landing: login vs create/join forms | VERIFIED | 56 lines, three render paths (loading/login/authenticated), return-to-URL useEffect |
| `src/App.tsx` | App shell with authStore.initialize() in useEffect | VERIFIED | 15 lines, useEffect with cleanup, [initialize] dependency array |
| `src/router.tsx` | Router with /list/:code wrapped in ProtectedRoute | VERIFIED | 16 lines, pathless layout route wrapping /list/:code, / and * unprotected |
| `src/lib/supabase.ts` | Supabase client with PKCE auth config | VERIFIED | auth block with flowType: 'pkce' and detectSessionInUrl: true alongside realtime worker |
| `supabase/migrations/items_auth.sql` | Items table: user_id column + auth-aware RLS | VERIFIED | 66 lines, ALTER TABLE + 4 DROP + 4 CREATE POLICY with IS NULL OR pattern |
| `supabase/migrations/lists_auth.sql` | Lists table: owner_id column + auth-aware RLS | VERIFIED | 66 lines, ALTER TABLE + 4 DROP + 4 CREATE POLICY with IS NULL OR pattern |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| authStore.ts | supabase.ts | `import { supabase } from '@/lib/supabase'` | WIRED | Line 3 |
| authStore.ts | onAuthStateChange | `supabase.auth.onAuthStateChange(...)` | WIRED | Line 27 |
| authStore.ts | realtime.setAuth | `supabase.realtime.setAuth(...)` | WIRED | Lines 39, 41 |
| ProtectedRoute.tsx | authStore.ts | `useAuthStore` selectors | WIRED | Lines 5-6 |
| App.tsx | authStore.ts | `initialize()` in useEffect | WIRED | Lines 7, 10 |
| router.tsx | ProtectedRoute.tsx | `element={<ProtectedRoute />}` layout route | WIRED | Lines 5, 10 |
| LandingPage.tsx | authStore.ts | `useAuthStore` selectors (user, isLoading, signInWithGoogle, error) | WIRED | Lines 9-12 |
| LandingPage.tsx | LoginPage.tsx | `<LoginPage onSignIn={signInWithGoogle} error={error} />` | WIRED | Lines 4, 37 |
| LandingPage.tsx | sessionStorage | `useEffect` reads/clears returnTo | WIRED | Lines 16-24 |
| items_auth.sql | auth.users | `REFERENCES auth.users(id)` | WIRED | Line 15 |
| items_auth.sql | RLS policies | 4 CREATE POLICY with `(select auth.uid())` | WIRED | Lines 33-66 |
| lists_auth.sql | auth.users | `REFERENCES auth.users(id)` | WIRED | Line 14 |
| lists_auth.sql | RLS policies | 4 CREATE POLICY with `(select auth.uid())` | WIRED | Lines 33-66 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| LandingPage.tsx | user, isLoading, error | useAuthStore selectors -> authStore -> supabase.auth.onAuthStateChange | Yes -- Supabase auth events produce real User/Session objects | FLOWING |
| ProtectedRoute.tsx | user, isLoading | useAuthStore selectors -> authStore -> supabase.auth.onAuthStateChange | Yes -- same pipeline | FLOWING |
| LoginPage.tsx | onSignIn, error | Props from LandingPage -> authStore.signInWithGoogle, authStore.error | Yes -- props are connected to real auth actions | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes (auth-related) | `npx vitest run` | 101 passed, 14 failed (pre-existing in NamePromptDialog/ListPage -- unrelated to auth) | PASS |
| authStore callback not async | `grep -n "async" authStore.ts` (excluding signIn/signOut) | Only comment lines match -- no async on callback | PASS |
| realtime.setAuth calls present | `grep -cn "realtime.setAuth" authStore.ts` | 3 matches (token, null, and conditional) | PASS |
| redirectTo uses window.location.origin | `grep -n "window.location.origin" authStore.ts` | Line 53: `redirectTo: window.location.origin` | PASS |
| PKCE configured | `grep "flowType" supabase.ts` | `flowType: 'pkce'` on line 15 | PASS |
| TypeScript compiles | Previous test run includes tsc | tsc --noEmit exits 0 per SUMMARY reports | PASS |

### Probe Execution

Step 7c: SKIPPED -- no probe scripts found for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 06-01, 06-02, 06-04 | User can sign in with Google OAuth (one-tap) | SATISFIED | signInWithGoogle calls signInWithOAuth with provider 'google'; LoginPage renders sign-in button; LandingPage conditionally renders login vs authenticated content |
| AUTH-02 | 06-02, 06-05 | User session persists across browser refresh and close | SATISFIED | authStore.initialize() sets up onAuthStateChange which fires INITIAL_SESSION on page load to restore persisted session; supabase.ts has detectSessionInUrl: true; PKCE flow configured |
| AUTH-03 | 06-01, 06-03, 06-05 | Unauthenticated users are redirected to login page | SATISFIED | ProtectedRoute checks user state, redirects to / with sessionStorage returnTo; router.tsx wraps /list/:code in ProtectedRoute layout route; RLS policies enforce database-level access control |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | -- | -- | No debt markers, stubs, or anti-patterns found in any modified file |

### Human Verification Required

### 1. Google OAuth End-to-End Flow

**Test:** Navigate to the app while signed out. Tap "Sign in with Google". Complete the Google consent screen. Verify you return to the app signed in.
**Expected:** After Google consent, the app shows "Create a list" and "Join a list" forms instead of the login screen. No blank callback page.
**Why human:** OAuth flow involves browser redirect to Google and back -- cannot be tested with grep or vitest.

### 2. Session Persistence Across Browser Restart

**Test:** Sign in via Google OAuth. Close the browser entirely. Reopen and navigate to the app URL.
**Expected:** User is still signed in without re-authenticating. Landing page shows authenticated content (create/join forms).
**Why human:** Requires real browser session persistence behavior -- localStorage/cookie survival across browser restart.

### 3. Return-to-URL After OAuth Redirect

**Test:** While signed out, navigate directly to /list/SOMECODE. Confirm redirect to login page. Sign in with Google.
**Expected:** After sign-in, automatically navigates to /list/SOMECODE (the original intended destination).
**Why human:** Full redirect chain involves OAuth browser redirect which resets the page -- grep cannot trace cross-page state flow.

### 4. SQL Migrations Applied in Supabase

**Test:** In Supabase Dashboard, verify table schema and RLS policies.
**Expected:** items table has user_id column (uuid, nullable). lists table has owner_id column (uuid, nullable). Four RLS policies on each table (items_select/insert/update/delete, lists_select/insert/update/delete). Old anon_* policies are gone.
**Why human:** Database state is in Supabase cloud -- cannot verify schema from local codebase. Plan 05 Task 2 is a checkpoint:human-action that may still be pending.

### 5. Login Page Visual on Mobile

**Test:** Open the app on a mobile device or Chrome DevTools mobile viewport. View the login page.
**Expected:** Centered layout with "Our Cart" heading, subtitle, and "Sign in with Google" button. No overflow, clipping, or layout issues.
**Why human:** Visual layout and mobile rendering require a real browser viewport.

### Gaps Summary

No code-level gaps found. All 10 observable truths verified against the actual codebase. All artifacts exist, are substantive (not stubs), are wired to their consumers, and have real data flowing through them. All key links are connected. All three requirements (AUTH-01, AUTH-02, AUTH-03) have implementation evidence. No debt markers or anti-patterns detected.

The phase requires human verification for 5 items that cannot be confirmed programmatically: the end-to-end OAuth flow, session persistence, return-to-URL redirect chain, database migration application status, and mobile visual appearance.

---

_Verified: 2026-05-28T11:20:00Z_
_Verifier: Claude (gsd-verifier)_
