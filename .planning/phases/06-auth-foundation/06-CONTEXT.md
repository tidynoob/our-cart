# Phase 6: Auth Foundation - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning
**Mode:** --auto (decisions auto-selected to recommended defaults; review before planning)

<domain>
## Phase Boundary

This phase adds Google OAuth sign-in via Supabase Auth, persistent sessions across browser close/reopen, and route protection that redirects unauthenticated users to the login page. It also lays the database auth scaffolding (user_id columns, RLS policy updates) needed by downstream phases. After this phase, the app knows who you are and keeps you signed in.

Requirements: AUTH-01, AUTH-02, AUTH-03.

**Out of scope:** Multiple lists (Phase 7), sidebar navigation (Phase 8), user profile editing/display name (Phase 9), avatar display (Phase 9), sign-out UI (Phase 9), list sharing/invite links (Phase 10). No email/password auth (REQUIREMENTS.md Out of Scope). No anonymous/no-auth access preservation as a first-class feature — but existing anonymous lists remain accessible via nullable user_id (locked decision).

</domain>

<decisions>
## Implementation Decisions

### Login Page Layout (AUTH-01)
- **D-01:** Transform the current landing page (`/`) into a login-first experience. Unauthenticated users see the sign-in screen; authenticated users see the create/join list flow (existing LandingPage content). No separate `/login` route — the root route handles both states based on auth status.
- **D-02:** Login screen shows the app name/logo centered at top, followed by a single "Sign in with Google" button. Clean, minimal, phone-first. No email/password fields, no "create account" flow — Google OAuth is the only auth method (per REQUIREMENTS.md Out of Scope).

### Post-Login Destination (AUTH-01)
- **D-03:** After completing Google OAuth, user lands on the root page (`/`) which now shows the authenticated landing experience (create/join list). No "my lists" page exists yet — that comes in Phase 7. The OAuth callback redirects to `/` after successful authentication.
- **D-04:** If a user was trying to access `/list/:code` while unauthenticated, store the intended destination and redirect there after successful sign-in (return-to-URL pattern). This satisfies success criterion #4 ("user lands on the correct destination").

### Route Protection (AUTH-03)
- **D-05:** A `ProtectedRoute` wrapper component checks auth state. If unauthenticated, redirect to `/`. If auth is still loading (`isLoading` state), show a loading spinner — not a flash of login screen (locked decision from STATE.md: "`isLoading` guard required on ProtectedRoute to prevent auth state flash").
- **D-06:** Apply `ProtectedRoute` to `/list/:code` route. The root route `/` is not protected — it conditionally renders login vs. authenticated content.

### Auth State Management
- **D-07:** Auth state lives in a Zustand store (`authStore`) — matches the existing pattern where stores own server-derived state (`itemsStore`). Fields: `user`, `session`, `isLoading`, `error`. Actions: `initialize()` (sets up `onAuthStateChange` listener), `signInWithGoogle()`, `signOut()`.
- **D-08:** `onAuthStateChange` listener initializes in `App.tsx` (or a top-level provider) on mount. Callback must NOT be async (locked decision from STATE.md). On auth state change, call `realtime.setAuth()` so existing realtime channels pick up the new JWT (locked decision from STATE.md).

### Database Auth Scaffolding
- **D-09:** Add `user_id` column (nullable, references `auth.users`) to the `items` table. Nullable because v1.0 items have no user_id (locked decision from STATE.md: "Nullable user_id on items"). New items created after auth will populate user_id from `auth.uid()`.
- **D-10:** Update RLS policies on `items` table to use `(select auth.uid())` (locked decision from STATE.md — query planner caching). Policy pattern: `user_id IS NULL OR user_id = auth.uid()` for SELECT/UPDATE/DELETE. INSERT policy sets `user_id = auth.uid()`. This preserves access to existing anonymous items while securing new ones.
- **D-11:** Add `lists` table scaffolding with `owner_id` referencing `auth.users`. Even though Phase 7 builds the full multi-list CRUD, the table structure needs to exist for RLS policies that reference list ownership. Minimum schema: `id`, `name`, `share_code`, `owner_id`, `created_at`.

### OAuth Configuration
- **D-12:** Use PKCE flow (locked decision from STATE.md — Supabase default for browser apps). Configure Google OAuth provider in Supabase Dashboard. OAuth redirect URL must match in 3 places: Supabase Site URL config, Supabase redirect allowlist, Google Cloud Console authorized redirect URIs (locked decision from STATE.md).
- **D-13:** Environment-specific redirect URLs: localhost for dev, production domain for deployed app. Store in Supabase Dashboard config, not in code (Supabase handles redirect URL validation server-side).

### Claude's Discretion
- **Loading spinner style:** Minimal spinner or skeleton screen during auth state resolution — planner decides. Must not flash the login page.
- **Auth error handling:** How to surface OAuth failures (popup toast, inline error, redirect to error page) — planner decides. Failures should be recoverable (retry button).
- **Google button styling:** Use Google's brand guidelines for the sign-in button, or a simpler styled button — planner decides. Either way, the button text should be "Sign in with Google".
- **Supabase client config:** Whether to add `auth.flowType: 'pkce'` explicitly to the supabase client config or rely on Supabase default — planner decides.
- **Migration ordering:** Whether D-09 (user_id column) and D-11 (lists table) go in the same migration or separate — planner decides.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, $0-budget / 2-user constraints, "No auth — shared link access" key decision being replaced by this phase
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-03 (this phase); Out of Scope table (no email/password, no anonymous access)
- `.planning/ROADMAP.md` §Phase 6 — Goal ("sign in with Google and the app knows who they are across sessions"), success criteria, UI hint: yes
- `.planning/STATE.md` §Accumulated Context — All locked decisions: PKCE, nullable user_id, onAuthStateChange not async, realtime.setAuth(), isLoading guard, OAuth redirect URL matrix, RLS policy patterns

### Prior Phases
- `.planning/milestones/v1.0-phases/01-foundation/01-01-PLAN.md` §Task 2 — items table SQL, existing RLS policies, `checked` column, `list_id` foreign key structure
- `.planning/milestones/v1.0-phases/04-real-time-sync/04-CONTEXT.md` — D-08/D-09 (realtime subscription lifecycle in itemsStore, syncStatus)

### Technology
- `CLAUDE.md` §Technology Stack — React 19, Vite 8, Supabase (@supabase/supabase-js 2.106.1), Tailwind v4, Zustand, Vercel hosting
- Supabase Auth docs: https://supabase.com/docs/guides/auth
- Supabase Google OAuth guide: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase RLS securing API: https://supabase.com/docs/guides/api/securing-your-api

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase.ts` — Supabase client already initialized. Add auth config options here. `supabase.auth.signInWithOAuth()`, `supabase.auth.onAuthStateChange()`, `supabase.auth.getSession()` all available via this client.
- `src/stores/itemsStore.ts` — Zustand store pattern to follow for `authStore`. Uses `create()` with actions that call Supabase client methods.
- `src/stores/uiStore.ts` — Simple Zustand store for UI state. Same pattern.
- `src/pages/LandingPage.tsx` — Will be transformed to show login vs. authenticated content based on auth state. Currently renders CreateListForm + JoinListForm.
- `src/router.tsx` — Uses `createBrowserRouter` with 3 routes. ProtectedRoute wrapper will wrap `/list/:code` element.
- `src/App.tsx` — Minimal shell (`RouterProvider`). Auth initialization (onAuthStateChange listener) hooks into here.
- `src/components/ui/button.tsx` — shadcn Button component for the Google sign-in button.

### Established Patterns
- Zustand stores own server data + mutation logic; pages own ephemeral UI state.
- Supabase client in `src/lib/supabase.ts` — single client instance, imported everywhere.
- Router uses `createBrowserRouter` (React Router v6 data API).
- Tailwind v4 utility classes for all styling. Mobile-first.
- `max-w-sm` / `max-w-md` centered columns for page layout.

### Integration Points
- `src/router.tsx` — Wrap `/list/:code` route element with ProtectedRoute.
- `src/App.tsx` — Initialize auth listener on mount (useEffect or top-level call).
- `src/pages/LandingPage.tsx` — Conditional render: login screen vs. create/join flow.
- `src/stores/itemsStore.ts` — After auth, new items should include `user_id` from auth state. `realtime.setAuth()` call on auth change.
- Supabase Dashboard — Enable Google OAuth provider, configure redirect URLs.
- Supabase SQL Editor / Migration — Add user_id column, update RLS policies, create lists table.

</code_context>

<specifics>
## Specific Ideas

- The landing page transformation should feel seamless — same app, now with a sign-in gate. Not a jarring change.
- Return-to-URL is critical for the `/list/:code` share pattern — someone texting a list URL to their partner needs to land on that list after signing in, not the home page.
- The pre-code checklist from STATE.md Todos ("OAuth redirect URL matrix — 3 environments") should be a plan task, not forgotten.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Auth Foundation*
*Context gathered: 2026-05-27*
