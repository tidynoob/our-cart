# Phase 6: Auth Foundation - Research

**Researched:** 2026-05-27
**Domain:** Supabase Auth (Google OAuth, PKCE, onAuthStateChange), React Router v7 route protection, Zustand auth state, Postgres RLS for authenticated users
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login Page Layout (AUTH-01)**
- D-01: Transform the current landing page (`/`) into a login-first experience. Unauthenticated users see the sign-in screen; authenticated users see the create/join list flow (existing LandingPage content). No separate `/login` route — the root route handles both states based on auth status.
- D-02: Login screen shows the app name/logo centered at top, followed by a single "Sign in with Google" button. Clean, minimal, phone-first. No email/password fields, no "create account" flow.

**Post-Login Destination (AUTH-01)**
- D-03: After completing Google OAuth, user lands on the root page (`/`) which now shows the authenticated landing experience. OAuth callback redirects to `/` after successful authentication.
- D-04: If a user was trying to access `/list/:code` while unauthenticated, store the intended destination and redirect there after successful sign-in (return-to-URL pattern).

**Route Protection (AUTH-03)**
- D-05: A `ProtectedRoute` wrapper component checks auth state. If unauthenticated, redirect to `/`. If auth is still loading (`isLoading` state), show a loading spinner — not a flash of login screen.
- D-06: Apply `ProtectedRoute` to `/list/:code` route only.

**Auth State Management**
- D-07: Auth state lives in a Zustand store (`authStore`). Fields: `user`, `session`, `isLoading`, `error`. Actions: `initialize()`, `signInWithGoogle()`, `signOut()`.
- D-08: `onAuthStateChange` listener initializes in `App.tsx` on mount. Callback must NOT be async. On auth state change, call `realtime.setAuth()` so existing realtime channels pick up the new JWT.

**Database Auth Scaffolding**
- D-09: Add `user_id` column (nullable, references `auth.users`) to the `items` table. Nullable because v1.0 items have no user_id.
- D-10: Update RLS policies on `items` table: `user_id IS NULL OR (select auth.uid()) = user_id` for SELECT/UPDATE/DELETE. INSERT policy sets `user_id = (select auth.uid())`. Preserves anonymous item access.
- D-11: Add `lists` table scaffolding with `owner_id` referencing `auth.users`. Minimum schema: `id`, `name`, `share_code`, `owner_id`, `created_at`. NOTE: `lists` table already exists from v1.0 — this migration ADDs `owner_id` and updates its RLS.

**OAuth Configuration**
- D-12: Use PKCE flow (Supabase default for browser apps). Configure Google OAuth provider in Supabase Dashboard. OAuth redirect URL must match in 3 places: Supabase Site URL config, Supabase redirect allowlist, Google Cloud Console authorized redirect URIs.
- D-13: Environment-specific redirect URLs: localhost for dev, production domain for deployed app. Stored in Supabase Dashboard config.

### Claude's Discretion
- Loading spinner style: minimal spinner or skeleton during auth state resolution
- Auth error handling: how to surface OAuth failures (toast, inline error) — must be recoverable with retry
- Google button styling: follow Google brand guidelines or simpler custom button — text must be "Sign in with Google"
- Supabase client config: whether to add `auth.flowType: 'pkce'` explicitly or rely on default
- Migration ordering: D-09 (user_id column) and D-11 (lists owner_id) in same or separate migration

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign in with Google OAuth (one-tap) | `supabase.auth.signInWithOAuth({ provider: 'google' })` + Google OAuth dashboard config + PKCE auto-exchange |
| AUTH-02 | User session persists across browser refresh and close | Supabase Auth persists session to localStorage by default; `onAuthStateChange` fires `INITIAL_SESSION` on page load to restore state |
| AUTH-03 | Unauthenticated users are redirected to login page | `ProtectedRoute` component using React Router `Navigate` + `useLocation` for return-to URL |
</phase_requirements>

---

## Summary

Phase 6 adds Google OAuth via Supabase Auth to a working SPA. The core pattern is well-established: Supabase Auth handles PKCE code exchange automatically in browser SPAs when `detectSessionInUrl: true` (the default), so no separate `/auth/callback` server route is needed. The OAuth flow redirects back to the configured Supabase callback URL, which then redirects to the app's `redirectTo` destination; `onAuthStateChange` fires `INITIAL_SESSION` on every page load to restore persisted sessions from localStorage.

The `authStore` (Zustand) follows the existing `itemsStore` pattern exactly — `create()` with server-derived state and actions. The `ProtectedRoute` component is a thin wrapper using React Router's `Navigate` component with a `replace` redirect. The `isLoading` guard in `ProtectedRoute` is critical: without it, a brief flash of the login page occurs during the 20-50ms it takes for `INITIAL_SESSION` to fire after page load.

The database work is two migrations: (1) add `user_id` nullable column to `items`, update `items` RLS policies to accept `user_id IS NULL OR user_id = (select auth.uid())`; (2) add `owner_id` column to `lists`, update `lists` RLS policies. Both migrations must enable RLS and create policies atomically — enabling RLS without policies blocks all access.

The three-place redirect URL matrix (Supabase Site URL, Supabase allowlist, Google Cloud Console) is a manual Supabase Dashboard + Google Cloud Console task that must precede any code testing.

**Primary recommendation:** Configure OAuth providers first (human task), then implement authStore → App.tsx initialization → ProtectedRoute → LandingPage transformation → database migrations in that order. Test each layer before proceeding.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Google OAuth initiation | Browser / Client | — | `supabase.auth.signInWithOAuth()` called client-side; redirects browser to Google |
| PKCE code exchange | Browser / Client | — | `detectSessionInUrl: true` (default) auto-exchanges code on redirect back; no server needed |
| Session persistence | Browser / Client | — | Supabase Auth writes access_token + refresh_token to localStorage by default |
| Session restoration on page load | Browser / Client | — | `onAuthStateChange` fires `INITIAL_SESSION` event immediately on client init |
| Route protection guard | Browser / Client | — | React Router `ProtectedRoute` component redirects unauthenticated users |
| Auth state store | Browser / Client | — | Zustand `authStore` — matches existing `itemsStore` pattern |
| Return-to-URL after login | Browser / Client | — | Store intended path in `sessionStorage`; read after sign-in success |
| Realtime JWT update | Browser / Client | — | `supabase.realtime.setAuth(session.access_token)` called in `onAuthStateChange` |
| Google OAuth provider config | Database / Storage | — | Supabase Dashboard config + Google Cloud Console credentials |
| User identity (auth.uid()) | Database / Storage | — | Supabase Auth manages `auth.users` table |
| RLS enforcement | Database / Storage | — | Postgres RLS policies evaluate `auth.uid()` per-query |
| items.user_id schema | Database / Storage | — | SQL migration adds nullable FK column |
| lists.owner_id schema | Database / Storage | — | SQL migration adds nullable FK column to existing table |

---

## Standard Stack

### Core (all packages already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.106.2 (latest) | Auth client: signInWithOAuth, onAuthStateChange, getSession, realtime.setAuth | Already installed; auth is built into the client [VERIFIED: npm registry] |
| zustand | 5.0.13 | authStore for user/session/isLoading/error state | Already installed; matches itemsStore pattern [VERIFIED: npm registry] |
| react-router-dom | 7.15.1 | ProtectedRoute (Navigate), useLocation for return-to URL | Already installed [VERIFIED: npm registry] |

**No new packages required.** All auth capabilities are provided by `@supabase/supabase-js` which is already a project dependency.

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.16.0 | Loading spinner icon (Loader2) | isLoading state in ProtectedRoute |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Auth | Auth.js / NextAuth | Not applicable — Next.js SSR not in stack |
| Supabase Auth | Firebase Auth | Firebase removed free storage tier; Supabase already installed |
| Zustand authStore | React Context for auth | Context causes full-tree re-renders on auth change; Zustand is already the project pattern |
| detectSessionInUrl default | Manual exchangeCodeForSession | More code, not needed — Supabase handles code exchange automatically in browser SPAs |

**No new installations needed for this phase.**

---

## Package Legitimacy Audit

No new packages are introduced in this phase. All auth functionality comes from `@supabase/supabase-js` (already installed, slopcheck [OK] from Phase 1 audit).

| Package | Registry | Age | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|
| @supabase/supabase-js | npm | 5+ yrs | [OK] (verified Phase 1) | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User (browser)
    |
    | tap "Sign in with Google"
    v
[authStore.signInWithGoogle()]
    |
    | supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    v
[Google OAuth consent screen]
    |
    | redirect back to Supabase callback URL with ?code=...
    v
[Supabase Auth server]
    |
    | exchanges code for session, redirects to redirectTo (app origin)
    v
[App reloads at /]
    |
    | detectSessionInUrl: true auto-extracts session from URL
    v
[onAuthStateChange fires SIGNED_IN]
    |
    |-- set authStore.user, authStore.session, authStore.isLoading = false
    |-- supabase.realtime.setAuth(session.access_token)
    v
[LandingPage: sees authStore.user != null → shows create/join flow]


Page load (session already exists in localStorage):
[onAuthStateChange fires INITIAL_SESSION]
    |
    |-- set authStore.user, authStore.session, authStore.isLoading = false
    v
[ProtectedRoute: isLoading=false, user != null → renders ListPage]


Unauthenticated access to /list/:code:
[ProtectedRoute: isLoading=false, user = null]
    |
    | store intended path in sessionStorage
    v
[Navigate to "/" with replace]
    |
[LandingPage: shows login screen]
    |
    | user signs in
    v
[read sessionStorage for return path → navigate to /list/:code]
```

### Recommended Project Structure

```
src/
├── stores/
│   ├── itemsStore.ts        # existing
│   ├── uiStore.ts           # existing
│   └── authStore.ts         # NEW: user, session, isLoading, error + auth actions
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.tsx   # NEW: route guard component
│   │   └── LoginPage.tsx        # NEW: Google sign-in screen (or inline in LandingPage)
│   └── ui/                  # existing shadcn components
├── pages/
│   └── LandingPage.tsx      # MODIFY: conditional render based on authStore.user
├── lib/
│   └── supabase.ts          # MODIFY: add auth config options if needed
├── router.tsx               # MODIFY: wrap /list/:code with ProtectedRoute
└── App.tsx                  # MODIFY: initialize authStore on mount
```

### Pattern 1: authStore (Zustand)

Follow the exact structure of `itemsStore.ts`. The store is created with `create<AuthState>()((set, get) => ({...}))` and all Supabase calls happen inside actions.

```typescript
// Source: STATE.md locked decisions + itemsStore.ts pattern
import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
  initialize: () => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  isLoading: true,   // Start true — will be resolved by INITIAL_SESSION
  error: null,

  initialize: () => {
    // onAuthStateChange callback must NOT be async (STATE.md locked decision)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        set({
          user: session?.user ?? null,
          session: session,
          isLoading: false,
          error: null,
        })
        // Update Realtime JWT so existing channels pick up the new token
        // (STATE.md locked decision: realtime.setAuth on auth change)
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token)
        } else {
          supabase.realtime.setAuth(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  },

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

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) set({ error: error.message })
  },
}))
```

**Critical:** `initialize()` returns the unsubscribe function. Call it from App.tsx useEffect and return it as cleanup.

### Pattern 2: App.tsx Auth Initialization

```typescript
// Source: Supabase Auth docs + STATE.md
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useAuthStore } from '@/stores/authStore'

export default function App() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    const cleanup = initialize()
    return cleanup
  }, [initialize])

  return <RouterProvider router={router} />
}
```

### Pattern 3: ProtectedRoute Component

```typescript
// Source: React Router v7 docs + STATE.md isLoading guard
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const location = useLocation()

  // isLoading guard: never flash the login page before auth state resolves
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {/* Minimal spinner — planner decides exact style */}
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!user) {
    // Store intended path for return-to after sign-in
    sessionStorage.setItem('returnTo', location.pathname + location.search)
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
```

### Pattern 4: Router with ProtectedRoute

```typescript
// Source: src/router.tsx + React Router v7 data API
import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import ListPage from '@/pages/ListPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/list/:code', element: <ListPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```

### Pattern 5: LandingPage Conditional Render

```typescript
// Source: D-01/D-02 from CONTEXT.md
import { useAuthStore } from '@/stores/authStore'
import CreateListForm from '@/components/CreateListForm'
import JoinListForm from '@/components/JoinListForm'

export default function LandingPage() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)

  // While auth state resolves, render nothing (or spinner)
  // ProtectedRoute handles the loading state for /list/:code
  // LandingPage must handle its own because it's unprotected
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onSignIn={signInWithGoogle} />
  }

  // Authenticated: existing landing content
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Our Cart</h1>
      {/* ... existing CreateListForm + JoinListForm ... */}
    </main>
  )
}
```

### Pattern 6: Return-to-URL After Sign-In

The `signInWithGoogle` action redirects the browser to Google. After sign-in, the browser lands at `/`. The `LandingPage` should check `sessionStorage.getItem('returnTo')` after the user is authenticated and navigate there.

```typescript
// In LandingPage, after auth resolves:
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

### Pattern 7: Database Migration — items table

```sql
-- Source: STATE.md locked decisions D-09 and D-10
-- Migration: add user_id to items and update RLS policies

-- Step 1: Add nullable user_id column
ALTER TABLE items
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Drop existing anon INSERT and SELECT policies on items
-- (v1.0 had: anon_select_items, anon_insert_items)
DROP POLICY IF EXISTS "anon_select_items" ON items;
DROP POLICY IF EXISTS "anon_insert_items" ON items;
-- Also drop any update/delete policies if they exist
DROP POLICY IF EXISTS "anon_update_items" ON items;
DROP POLICY IF EXISTS "anon_delete_items" ON items;

-- Step 3: Create new policies that allow access for both:
--   - Legacy anonymous items (user_id IS NULL)
--   - Items owned by the authenticated user (user_id = auth.uid())
-- Use (select auth.uid()) not bare auth.uid() — query planner caching (STATE.md)

CREATE POLICY "items_select" ON items FOR SELECT
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );

CREATE POLICY "items_insert" ON items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );

CREATE POLICY "items_update" ON items FOR UPDATE
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  )
  WITH CHECK (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );

CREATE POLICY "items_delete" ON items FOR DELETE
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );
```

### Pattern 8: Database Migration — lists table

```sql
-- Source: STATE.md D-11: lists table already exists from v1.0
-- This migration ADDS owner_id to the existing lists table

-- Step 1: Add nullable owner_id column
ALTER TABLE lists
  ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Update lists RLS policies
-- v1.0 had: anon_select_lists, anon_insert_lists
DROP POLICY IF EXISTS "anon_select_lists" ON lists;
DROP POLICY IF EXISTS "anon_insert_lists" ON lists;

CREATE POLICY "lists_select" ON lists FOR SELECT
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );

CREATE POLICY "lists_insert" ON lists FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );

CREATE POLICY "lists_update" ON lists FOR UPDATE
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  )
  WITH CHECK (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );
```

**IMPORTANT:** `lists` and `items` tables already have RLS enabled from Phase 1. These migrations only add columns and replace policies — do NOT re-run `ENABLE ROW LEVEL SECURITY` (idempotent but worth noting). Always drop old policies before creating new ones with the same intent to avoid conflicts.

### Pattern 9: Supabase Client Config Update (optional PKCE explicit)

```typescript
// Source: deepwiki.com/supabase/supabase-js/2.2-client-configuration
// PKCE is the default flowType for @supabase/supabase-js
// Setting it explicitly makes intent clear but is not required

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    worker: true,
  },
  auth: {
    flowType: 'pkce',        // explicit; default is already 'pkce' in recent versions
    detectSessionInUrl: true, // default true; handles PKCE callback automatically
  },
})
```

Per Claude's Discretion (D-13 area): the planner decides whether to add this explicitly.

### Pattern 10: OAuth Redirect URL Matrix (Pre-Code Checklist)

Three places must be configured before any OAuth testing. This is a blocking human-action task.

| Location | Value (dev) | Value (prod) |
|----------|-------------|--------------|
| Supabase Dashboard → Authentication → URL Configuration → Site URL | `http://localhost:5173` | `https://your-production-domain.vercel.app` |
| Supabase Dashboard → Authentication → URL Configuration → Redirect URLs | `http://localhost:5173/**` | `https://your-production-domain.vercel.app/**` |
| Google Cloud Console → OAuth 2.0 Client → Authorized Redirect URIs | `https://<project-ref>.supabase.co/auth/v1/callback` | same (Supabase callback URL, not your app URL) |

The Google Cloud Console redirect URI points to Supabase, not your app. Supabase then redirects to your app's `redirectTo` URL. Only the Supabase allowlist governs which `redirectTo` values are accepted.

### Anti-Patterns to Avoid

- **Async onAuthStateChange callback:** Supabase requires the callback to be synchronous. Never `async (event, session) => { await something() }`. If you need async work triggered by auth events, dispatch to a separate async function.
- **Calling `getSession()` instead of using `onAuthStateChange`:** `getSession()` returns the cached local session without server validation. Use `onAuthStateChange` `INITIAL_SESSION` event for initial auth state.
- **Not unsubscribing from onAuthStateChange:** The subscription returned by `onAuthStateChange` must be unsubscribed in the useEffect cleanup, or it leaks.
- **Checking `user` before `isLoading` resolves:** Always render a loading state while `isLoading: true`. React renders synchronously — on first paint, `isLoading` is `true` and `user` is `null`, which looks identical to the unauthenticated state.
- **Enabling RLS without immediately creating policies:** Enabling RLS on a table blocks ALL access until policies are created. Always run `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` in the same transaction/migration.
- **Flash of login screen on ProtectedRoute:** Without `isLoading` guard, `user === null` during the initial render triggers a redirect to `/`, then `INITIAL_SESSION` fires and re-navigates — causing a visible flash. The `isLoading` spinner prevents this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PKCE flow | Manual code_verifier generation and code exchange | `supabase.auth.signInWithOAuth()` + `detectSessionInUrl: true` | Supabase handles verifier storage, challenge generation, and code exchange automatically |
| Session persistence | Manual localStorage read/write | `@supabase/supabase-js` default persistence | Auth client handles token storage, refresh, and expiry automatically |
| Token refresh | Manual JWT expiry check + refresh call | `autoRefreshToken: true` (default) | Auth client proactively refreshes before expiry, including on tab focus |
| OAuth provider button | Custom OAuth initiation flow | `supabase.auth.signInWithOAuth()` | Handles PKCE setup, redirect, and state validation internally |
| Realtime re-auth | Manual channel teardown/rebuild after sign-in | `supabase.realtime.setAuth(token)` | Updates JWT on existing channels without re-subscribing |

**Key insight:** Supabase Auth is a fully opinionated auth solution. The correct approach is thin wiring code (store + event listener), not custom auth logic.

---

## Common Pitfalls

### Pitfall 1: Auth State Flash (Login Screen Flicker)
**What goes wrong:** ProtectedRoute renders, `isLoading` is still `true`, `user` is `null` — but the code treats `null` as "unauthenticated" and redirects to `/`. Then `INITIAL_SESSION` fires 20-50ms later and the user gets navigated back. Visible as a flash of the login screen.
**Why it happens:** `onAuthStateChange` fires asynchronously after client initialization. There's always a brief window where `user === null` regardless of whether the user is signed in.
**How to avoid:** Never redirect when `isLoading === true`. Render a loading spinner instead.
**Warning signs:** Seeing the login page briefly flash when navigating directly to `/list/CODE` as a signed-in user.

### Pitfall 2: Async onAuthStateChange Callback
**What goes wrong:** Callback is declared `async`, causing Supabase to receive a Promise instead of void. This can cause silent auth failures or missed events.
**Why it happens:** Developer adds `async` to call `await supabase.auth.getUser()` or similar inside the callback.
**How to avoid:** Keep the callback synchronous. Dispatch async work outside: `const updateUser = async () => { ... }; updateUser()` — but never `await` inside the callback.
**Warning signs:** Auth events (SIGNED_OUT, TOKEN_REFRESHED) not updating the store correctly.

### Pitfall 3: Redirect URL Mismatch (OAuth failure)
**What goes wrong:** Google OAuth returns an error or redirects to a blank page.
**Why it happens:** The redirect URL in `signInWithOAuth({ options: { redirectTo } })` doesn't match an entry in the Supabase allowlist. OR the Google Cloud Console redirect URI doesn't include the Supabase callback URL.
**How to avoid:** Complete the 3-place redirect URL matrix checklist BEFORE writing any auth code. `window.location.origin` as `redirectTo` ensures dev vs prod is handled by the allowlist wildcard pattern.
**Warning signs:** `OAuth error: redirect_uri_mismatch` in the browser or Supabase auth logs.

### Pitfall 4: Enabling RLS Mid-Migration Without Policies
**What goes wrong:** An ALTER TABLE migration enables RLS on an existing table before the new policies are created. If the migration fails partway, the table is locked and the app breaks.
**Why it happens:** Copy-paste of partial migration SQL.
**How to avoid:** `DROP POLICY ... IF EXISTS` + `CREATE POLICY` must be in the same SQL execution as `ALTER TABLE`. For this phase, RLS is already enabled — only DROP + CREATE POLICY is needed.
**Warning signs:** `403 Forbidden` errors from Supabase PostgREST on previously working queries.

### Pitfall 5: Return-to-URL Lost After OAuth Redirect
**What goes wrong:** User navigates to `/list/ABC`, gets redirected to `/` for sign-in, signs in, but lands on `/` instead of `/list/ABC`.
**Why it happens:** The intended path is stored in component state (React useState), which is wiped when the browser navigates to Google and back.
**How to avoid:** Store the return path in `sessionStorage` (survives browser navigation within the same session but not tab close). Read and clear it after successful sign-in.
**Warning signs:** Success criterion 4 fails: "user lands on the correct destination."

### Pitfall 6: realtime.setAuth() Timing
**What goes wrong:** After sign-in, the existing Realtime channel (from itemsStore) continues using the old anonymous JWT. RLS policies reject updates from authenticated users because the channel was opened without auth.
**Why it happens:** The Realtime WebSocket caches the JWT at channel-open time. It doesn't automatically pick up the new session.
**How to avoid:** Call `supabase.realtime.setAuth(session.access_token)` inside `onAuthStateChange` callback for `SIGNED_IN` and `TOKEN_REFRESHED` events.
**Warning signs:** Real-time updates stop working after sign-in; RLS errors visible in Supabase logs.

---

## Code Examples

Verified patterns from official sources:

### onAuthStateChange Event Types
```typescript
// Source: Supabase docs + community patterns (MEDIUM confidence)
// Events to handle in the auth listener:
// INITIAL_SESSION — fires on page load with stored session (or null if not signed in)
// SIGNED_IN       — fires after successful OAuth, email link, etc.
// SIGNED_OUT      — fires after signOut()
// TOKEN_REFRESHED — fires when access token auto-renews (every ~1 hour)
// PASSWORD_RECOVERY — not used (no password auth in this app)
```

### realtime.setAuth API
```typescript
// Source: supabase.com/docs/reference/javascript/realtime-setauth [VERIFIED]
supabase.realtime.setAuth(session.access_token)
// Pass null to clear (on sign-out):
supabase.realtime.setAuth(null)
```

### RLS Performance Pattern
```sql
-- Source: Supabase RLS docs [CITED: supabase.com/docs/guides/database/postgres/row-level-security]
-- Use (select auth.uid()) not bare auth.uid()
-- The SELECT wrapper triggers PostgreSQL initPlan optimization:
-- the function is evaluated ONCE per query, not once per row
USING ( (select auth.uid()) = user_id )
-- NOT:
USING ( auth.uid() = user_id )  -- evaluated per row, ~10x slower on large tables
```

### signInWithOAuth for Google
```typescript
// Source: supabase.com/docs/guides/auth/social-login/auth-google [CITED]
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin,
    // For Google refresh tokens (optional — not needed for basic auth):
    // queryParams: { access_type: 'offline', prompt: 'consent' }
  },
})
```

### Google Sign-In Button Brand Requirements
Per [CITED: developers.google.com/identity/branding-guidelines]:
- Button text MUST be "Sign in with Google" (or "Sign up with Google" / "Continue with Google")
- If using Google logo: must be the official "G" mark on white background
- Font: Roboto Medium is required when using Google branding assets
- The simplest compliant option: a standard styled button with text "Sign in with Google" without the Google logo — acceptable if not displaying Google branding marks
- A plain styled button (no Google logo) avoids brand guidelines complexity entirely

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase implicit OAuth flow | PKCE flow default | supabase-js v2.x | More secure; code exchange via URL `?code=` param; no token in URL fragment |
| `anon` Supabase API key | `sb_publishable_xxx` format | ~2024 | Key name changed; same security model, just new naming convention |
| Manual `getSession()` for initial state | `onAuthStateChange` INITIAL_SESSION event | supabase-js v2.x | `INITIAL_SESSION` fires reliably on init; `getSession()` returns cached value without server validation |

**Note on implicit vs PKCE:** `@supabase/supabase-js` defaults have evolved. Current versions default to PKCE. Explicitly setting `flowType: 'pkce'` is a no-op on modern versions but documents intent clearly. [ASSUMED — based on deepwiki source, not official changelog]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@supabase/supabase-js` current default flowType is `pkce` (not `implicit`) for browser environments | Standard Stack, Pattern 9 | Low — even if default is implicit, adding `flowType: 'pkce'` explicitly in supabase.ts is a Claude's Discretion item and safe to add regardless |
| A2 | `detectSessionInUrl: true` (default) auto-handles PKCE code exchange in a browser SPA without a dedicated /auth/callback route | Architecture Patterns | Medium — if wrong, a `/auth/callback` route handling `exchangeCodeForSession()` is needed. The pattern is well-supported by official docs and multiple community sources, but exact behavior may depend on supabase-js version. |
| A3 | The existing `lists` table from v1.0 does NOT yet have an `owner_id` column | Pattern 8 | Low — if column already exists, the ALTER TABLE will error; easily fixed by checking first with `\d lists` in SQL editor |
| A4 | `supabase.realtime.setAuth(null)` is valid syntax for clearing auth on sign-out | Pattern 1, Pitfall 6 | Low — documentation confirms null input resets to the accessToken callback. Worst case: call `setAuth('')` instead |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **Does `items` table currently have any UPDATE or DELETE policies from v1.0?**
   - What we know: v1.0 Phase 1 SQL only created `anon_select_items` and `anon_insert_items` policies. No UPDATE/DELETE policies were specified.
   - What's unclear: Were any UPDATE/DELETE policies added later in v1.0 phases (phases 2-5)?
   - Recommendation: Migration should use `DROP POLICY IF EXISTS` with all plausible names before creating new policies. The planner should grep existing plans for any `CREATE POLICY ... ON items` statements beyond the two in Phase 1.

2. **Should `items.user_id` be populated for new items automatically (via DB DEFAULT) or in application code?**
   - What we know: D-09 says new items created after auth will populate user_id from `auth.uid()`. This can be done in SQL (DEFAULT auth.uid()) or in the addItem action.
   - What's unclear: The CONTEXT.md doesn't specify SQL DEFAULT vs application-level assignment.
   - Recommendation: Use SQL `DEFAULT (select auth.uid())` on the column — this ensures user_id is always set by the database even if the application forgets to include it. The application INSERT in `itemsStore.addItem()` can also explicitly pass `user_id: authStore.user?.id` for clarity.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | ✓ | 20.12.1 | — |
| npm | Package management | ✓ | 10.5.0 | — |
| Supabase project | Database + Auth | Must verify | — | None — human creates project |
| Google Cloud Console | OAuth credentials | Must configure | — | None — human task |
| Vercel deployment | Production OAuth testing | Existing deployment | — | Test with localhost only |

**Missing dependencies with no fallback:**
- Google Cloud Console OAuth credentials — human must create them before OAuth testing
- Supabase Google provider config — human must enable it in Supabase Dashboard → Authentication → Providers

**Missing dependencies with fallback:**
- Production redirect URL — dev testing works on localhost; production config added before deployment

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.3 + @testing-library/react 16.3.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

Current suite: 93 tests passing across 12 files.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `signInWithGoogle()` calls `supabase.auth.signInWithOAuth` with correct provider | unit | `npx vitest run src/stores/authStore.test.ts` | ❌ Wave 0 |
| AUTH-01 | `signInWithGoogle()` sets `error` state on OAuth failure | unit | `npx vitest run src/stores/authStore.test.ts` | ❌ Wave 0 |
| AUTH-02 | `initialize()` calls `onAuthStateChange` and sets `user`/`session` from `INITIAL_SESSION` event | unit | `npx vitest run src/stores/authStore.test.ts` | ❌ Wave 0 |
| AUTH-02 | `initialize()` sets `isLoading: false` after `INITIAL_SESSION` fires | unit | `npx vitest run src/stores/authStore.test.ts` | ❌ Wave 0 |
| AUTH-02 | `initialize()` sets `isLoading: false` when session is null (not signed in) | unit | `npx vitest run src/stores/authStore.test.ts` | ❌ Wave 0 |
| AUTH-03 | ProtectedRoute renders loading spinner when `isLoading: true` | unit | `npx vitest run src/components/auth/ProtectedRoute.test.tsx` | ❌ Wave 0 |
| AUTH-03 | ProtectedRoute redirects to `/` when `isLoading: false` and `user: null` | unit | `npx vitest run src/components/auth/ProtectedRoute.test.tsx` | ❌ Wave 0 |
| AUTH-03 | ProtectedRoute renders `<Outlet />` when `isLoading: false` and `user` exists | unit | `npx vitest run src/components/auth/ProtectedRoute.test.tsx` | ❌ Wave 0 |
| AUTH-03 | ProtectedRoute stores intended path in sessionStorage before redirect | unit | `npx vitest run src/components/auth/ProtectedRoute.test.tsx` | ❌ Wave 0 |
| AUTH-01 | LandingPage renders LoginScreen (Google button) when `user: null` and `isLoading: false` | unit | `npx vitest run src/pages/LandingPage.test.tsx` | ❌ Wave 0 (new test in existing file) |
| AUTH-01 | LandingPage renders create/join content when `user` is populated | unit | `npx vitest run src/pages/LandingPage.test.tsx` | ❌ Wave 0 (new test in existing file) |

**Manual-only tests (cannot be automated):**
- OAuth redirect flow end-to-end (requires browser + Google account)
- Session persistence across browser close/reopen
- Supabase Dashboard OAuth provider configuration

### Sampling Rate
- **Per task commit:** `npx vitest run src/stores/authStore.test.ts src/components/auth/ProtectedRoute.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite (93 + new tests) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/stores/authStore.test.ts` — covers AUTH-01, AUTH-02
- [ ] `src/components/auth/ProtectedRoute.test.tsx` — covers AUTH-03
- [ ] New tests in `src/pages/LandingPage.test.tsx` — covers AUTH-01 UI conditional rendering

---

## Security Domain

### Applicable ASVS Categories (ASVS Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth — Google OAuth only; no password-based auth |
| V3 Session Management | yes | Supabase Auth manages session lifecycle, JWT refresh, localStorage persistence |
| V4 Access Control | yes | Postgres RLS policies + ProtectedRoute client-side guard |
| V5 Input Validation | no | No new user text inputs in this phase |
| V6 Cryptography | no | Supabase handles PKCE crypto internally; never hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OAuth redirect URI manipulation | Spoofing | Supabase allowlist validates `redirectTo` server-side; wildcard patterns are scoped |
| Token leakage via URL fragment | Information Disclosure | PKCE uses `?code=` query param (not fragment); code exchanged once, server-side |
| Session fixation | Elevation of Privilege | Supabase issues new JWT on sign-in; old anonymous session is not reused |
| RLS misconfiguration locks data | Denial of Service | Always drop old policies and create new ones in the same migration |
| Cross-origin JWT reuse in Realtime | Spoofing | `realtime.setAuth()` updates JWT per-connection; old channels can't be hijacked |
| Publishable key in bundle | Information Disclosure | `VITE_SUPABASE_PUBLISHABLE_KEY` is public by design; RLS is the enforcement layer |
| Service-role key accidentally exposed | Elevation of Privilege | Key never used client-side; `.env.local` in `.gitignore` |

**NOTE:** `ProtectedRoute` is a UX convenience, not a security control. Security enforcement is always at the database (RLS) layer. Client-side route protection does not prevent direct API calls.

---

## Sources

### Primary (HIGH confidence)
- [CITED: supabase.com/docs/guides/auth/social-login/auth-google] — Google OAuth setup steps, redirect URI, PKCE overview
- [CITED: supabase.com/docs/guides/auth/redirect-urls] — Redirect URL allowlist, wildcard patterns
- [CITED: supabase.com/docs/reference/javascript/realtime-setauth] — `realtime.setAuth()` API signature
- [CITED: supabase.com/docs/guides/database/postgres/row-level-security] — RLS policy SQL patterns
- [CITED: developers.google.com/identity/branding-guidelines] — Google Sign-In button brand requirements
- [CITED: deepwiki.com/supabase/supabase-js/2.2-client-configuration] — `auth.flowType`, `detectSessionInUrl`, `persistSession` options
- [CITED: deepwiki.com/supabase/supabase-js/3.3-pkce-flow] — PKCE code challenge generation, storage, exchange

### Secondary (MEDIUM confidence)
- [CITED: robinwieruch.de/react-router-private-routes/] — React Router v7 ProtectedRoute pattern with Navigate + Outlet
- [CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv] — (select auth.uid()) performance rationale (404 — verified via search results citing same content)
- [CITED: supabase.com/docs/guides/auth/sessions/pkce-flow] — detectSessionInUrl behavior, callback handling

### Tertiary (LOW confidence — flagged in Assumptions Log)
- [ASSUMED] Default flowType is 'pkce' in recent supabase-js versions — confirmed via multiple community sources but not official changelog
- [ASSUMED] detectSessionInUrl auto-handles PKCE exchange in SPAs without callback route — multiple sources agree but deepwiki notes nuance

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; @supabase/supabase-js auth API is well-documented
- Architecture: HIGH — patterns verified against official Supabase docs and existing project conventions
- Pitfalls: HIGH — all pitfalls are either locked in STATE.md or verified via official sources
- Database migrations: HIGH — SQL patterns match official RLS documentation
- PKCE auto-exchange behavior: MEDIUM — mostly verified but tagged [ASSUMED] due to version sensitivity

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (Supabase Auth APIs are stable; 30-day window applies)
