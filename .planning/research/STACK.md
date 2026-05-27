# Stack Research

**Domain:** Shared grocery list — v2.0 Accounts & Multi-List additions
**Researched:** 2026-05-27
**Confidence:** HIGH (all new additions verified against official Supabase docs and shadcn/ui docs)

---

## Unchanged Stack (Do Not Re-Research)

The following v1.0 stack is validated and carries forward unchanged:

- React 19.2.6 + Vite 5.4.21 + TypeScript 5.8.3
- @supabase/supabase-js 2.106.1 (Postgres + Realtime)
- Zustand 5.0.13 (client UI state)
- Tailwind CSS 4.3.0 + selective shadcn/ui
- Vercel hosting + Supabase free tier
- react-router-dom 7.15.1, nanoid 5.1.11, lucide-react 1.16.0

**Note on package.json:** The project is already on Vite 5.4.21 (not 8), per `package.json`. CLAUDE.md references Vite 8 but this appears to be aspirational documentation. The actual installed version is 5.4.21 — use what's installed.

---

## New Additions for v2.0

### Authentication: Supabase Auth (No New Package Required)

**The `@supabase/supabase-js` SDK already includes full auth support.** No additional auth package is needed.

The existing `supabase` client in `src/lib/supabase.ts` already has `supabase.auth.*` methods available. Authentication is configured entirely through the Supabase dashboard and env vars.

**What changes in the Supabase client:** None to the package. Add `flowType: 'implicit'` explicitly to auth config to be unambiguous about SPA behavior (implicit flow is the default for browser SPAs; PKCE is for SSR — we are a pure SPA with no server-side code). The Supabase client auto-detects the OAuth callback from the URL hash after Google redirect and persists the session to `localStorage` automatically.

**Auth API surface used:**
```typescript
// Sign in
supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })

// Listen for auth state changes (set up once at app root)
supabase.auth.onAuthStateChange((event, session) => { /* update Zustand authStore */ })

// Get current user
supabase.auth.getUser()

// Get current session
supabase.auth.getSession()

// Update display name
supabase.auth.updateUser({ data: { display_name: 'Mitch' } })

// Sign out
supabase.auth.signOut()
```

**Google OAuth from user_metadata:** When a user authenticates via Google, Supabase automatically populates `user.user_metadata.full_name` and `user.user_metadata.avatar_url`. Use `full_name` as the initial display name, let users override it. Confirmed behavior from Supabase discussions.

**Session persistence:** Supabase-js handles `localStorage` token storage and auto-refresh automatically. Do NOT use Zustand `persist` middleware for auth tokens — tokens in localStorage via Zustand is redundant and an unnecessary XSS surface. Zustand's `authStore` should hold the user object derived from the session (non-sensitive), not the raw JWT.

**Supabase dashboard configuration required:**
1. Enable Google provider in Authentication > Providers
2. Set Authorized redirect URI in Google Cloud Console: `https://<project>.supabase.co/auth/v1/callback`
3. Add `http://localhost:5173` and the production domain to Supabase's "Redirect URLs" allowlist

**API key note:** The project currently uses `VITE_SUPABASE_PUBLISHABLE_KEY` (already the new `sb_publishable_*` format). This is correct — the legacy anon key works until end of 2026 but the new key is already in use.

---

### New Zustand Store: `authStore`

Add a new Zustand store (no new package) for auth state. Separate from `uiStore` and `itemsStore` because auth state is global and lifecycle-independent of any list.

```typescript
// src/stores/authStore.ts
interface AuthState {
  user: User | null           // supabase User object (from auth.getUser())
  loading: boolean            // true while initial session check is in-flight
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}
```

Wire it in `App.tsx` or a top-level `AuthProvider` component via `supabase.auth.onAuthStateChange`. This pattern is standard and confirmed in Supabase's React quickstart docs.

**Do NOT use Zustand persist for auth** — the Supabase client already handles token persistence in localStorage. The Zustand store is just a React-friendly view of the current auth state, not a persistence layer.

---

### New shadcn/ui Component: Sheet (Mobile Sidebar Overlay)

**Install:**
```bash
npx shadcn@latest add sheet
```

The `Sheet` component (from shadcn/ui, built on Radix UI Dialog) is the correct primitive for the mobile sidebar. It slides in from the left edge, handles focus trapping, keyboard navigation, and `aria-modal` semantics correctly. This is the standard pattern for mobile navigation drawers in the shadcn ecosystem.

**Why Sheet over the full shadcn Sidebar component:** The shadcn `Sidebar` component is a heavy, opinionated dashboard layout system with `SidebarProvider`, `useSidebar` hook, and complex CSS variable system — it's designed for admin dashboards with persistent sidebars. This app needs a simple slide-in panel on mobile that lists the user's lists. `Sheet` is the right size tool: minimal, composable, already understood by the codebase (Dialog is the same primitive).

**On desktop:** A persistent narrow sidebar or collapsible panel can be built with plain Tailwind utilities (fixed positioning, transform translate). No additional component needed.

**Sheet usage pattern:**
```tsx
<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent side="left" className="w-72">
    {/* List of lists, user profile link, create list button */}
  </SheetContent>
</Sheet>
```

---

### No New Router Package Needed

react-router-dom 7.15.1 is already installed. Use nested layout routes with `<Outlet />` for the authenticated shell:

```
/                    → LandingPage (unauthenticated, shows sign-in)
/auth/callback       → AuthCallbackPage (handles implicit flow URL hash — may be no-op if Supabase handles automatically)
/app                 → AuthenticatedLayout (protected, renders sidebar + Outlet)
  /app/list/:id      → ListPage (per-list view)
  /app/settings      → SettingsPage (display name, sign out)
```

`AuthenticatedLayout` checks `authStore.user` — if null, redirects to `/`. If user is present, renders sidebar + `<Outlet />`. This is the standard react-router-dom protected route pattern.

**Route guard implementation:** A simple component that reads from Zustand's `authStore`:
```tsx
function RequireAuth({ children }) {
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />
  return children
}
```

---

### Database Schema Additions (Supabase, no new packages)

**New tables:**

1. **`profiles`** — stores editable display name, references `auth.users`:
   ```sql
   create table profiles (
     id uuid primary key references auth.users on delete cascade,
     display_name text,
     updated_at timestamptz default now()
   );
   alter table profiles enable row level security;
   -- Policy: users can only read/write their own row
   create policy "Users manage own profile"
     on profiles using ((select auth.uid()) = id);
   ```
   Use a trigger to auto-create a profile row on user sign-up (`after insert on auth.users`).

2. **`list_members`** — join table for list ownership/sharing:
   ```sql
   create table list_members (
     list_id uuid references lists on delete cascade,
     user_id uuid references auth.users on delete cascade,
     role text default 'member', -- 'owner' | 'member'
     primary key (list_id, user_id)
   );
   alter table list_members enable row level security;
   ```

3. **`lists` table RLS update** — add policies so authenticated users can only see/modify lists they belong to (via `list_members`):
   ```sql
   create policy "Members can view their lists"
     on lists for select to authenticated
     using (
       exists (
         select 1 from list_members
         where list_members.list_id = lists.id
           and list_members.user_id = (select auth.uid())
       )
     );
   ```

4. **`items` table RLS update** — items readable/writable to list members only.

**Sharing mechanism:** When user creates a list, insert into both `lists` and `list_members` (role='owner'). To share, generate a short invite token (nanoid — already in project) stored in a `list_invites` table. Partner visits `/join/:token`, Supabase resolves the list, inserts them into `list_members`. No email required for a 2-person app.

---

### No New State Management Package

Zustand 5.0.13 is already installed. Add an `authStore` (as above) and a `listsStore` for managing multiple lists. The existing `itemsStore` already scopes by `list_id` — that pattern extends naturally.

---

## Recommended New shadcn/ui Components

| Component | Install Command | Use Case |
|-----------|----------------|----------|
| Sheet | `npx shadcn@latest add sheet` | Mobile sidebar overlay |
| Avatar | `npx shadcn@latest add avatar` | User profile picture (from Google `avatar_url`) |

**Avoid installing:** shadcn Sidebar (too heavy for this use case), shadcn NavigationMenu (overkill for a list of 2-5 lists), any form library — existing `useState` patterns are sufficient.

---

## Installation Summary (v2.0 additions only)

```bash
# No new npm packages needed for auth — supabase-js already includes it

# New shadcn components
npx shadcn@latest add sheet
npx shadcn@latest add avatar
```

**Total new npm dependencies for v2.0: 0.** All capabilities come from packages already installed.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Supabase Auth (built-in) | NextAuth / Auth.js | Requires a server/API route; this is a pure client SPA with no server. Auth.js v5 works with Vite but adds complexity for no gain when Supabase handles OAuth natively |
| Supabase Auth (built-in) | Clerk | Clerk free tier is generous but adds a third-party dependency and monthly active user limits. Supabase Auth is already bundled and free |
| Supabase Auth (built-in) | Firebase Auth | Firebase Auth is solid but adding a second backend service creates split infrastructure (Supabase already owns our data) |
| Sheet (shadcn) | shadcn Sidebar | Sidebar is a full dashboard layout system; Sheet is the correct primitive for a slide-in drawer on mobile |
| Sheet (shadcn) | Vaul Drawer | Vaul is bottom-sheet focused (swipe-up from bottom); a sidebar comes from the left. Sheet is the right primitive |
| profiles table | user_metadata only | user_metadata is Supabase-auth-internal and not directly queryable from the public schema with RLS. A `profiles` table is accessible, securable, and joinable |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| @supabase/auth-ui-react | Pre-built sign-in form component — too opinionated, hard to style with Tailwind v4, overkill for a single "Sign in with Google" button | A single `<Button onClick={signInWithGoogle}>` in 5 lines of code |
| @supabase/ssr | SSR helper package for cookie-based sessions — only needed for Next.js/Remix SSR apps | `@supabase/supabase-js` direct (SPA uses implicit flow + localStorage, no cookies) |
| react-query / TanStack Query | Cache management layer — Supabase Realtime still pushes updates; multi-list doesn't change this | Zustand stores with direct Supabase calls (same pattern as v1) |
| zustand/persist for auth tokens | localStorage JWT storage via Zustand is a redundant XSS surface; Supabase-js already manages this securely | supabase.auth.getSession() / onAuthStateChange |

---

## Version Compatibility

| Package | Version | Compatibility Notes |
|---------|---------|---------------------|
| @supabase/supabase-js | 2.106.1 (existing) | Auth methods fully supported. Google OAuth via `signInWithOAuth` confirmed working in v2.x |
| react-router-dom | 7.15.1 (existing) | Nested layout routes with `<Outlet />` confirmed in v7. Protected route pattern is standard |
| shadcn/ui Sheet | CLI-installed | Based on Radix UI Dialog. Compatible with Tailwind v4 and React 19 (confirmed in shadcn docs) |
| shadcn/ui Avatar | CLI-installed | Compatible with Tailwind v4 and React 19 |
| zustand | 5.0.13 (existing) | `create()` API unchanged; add new stores with same pattern |

---

## Sources

- Supabase Auth Google OAuth (official docs): https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Auth implicit flow (official docs): https://supabase.com/docs/guides/auth/sessions/implicit-flow
- Supabase Auth React quickstart (official docs): https://supabase.com/docs/guides/auth/quickstarts/react
- Supabase RLS (official docs): https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase managing user data (official docs): https://supabase.com/docs/guides/auth/managing-user-data
- Supabase auth updateUser (official docs): https://supabase.com/docs/reference/javascript/auth-updateuser
- Supabase API key migration (changelog): https://supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys
- shadcn/ui Sheet component (official docs): https://ui.shadcn.com/docs/components/radix/sheet
- shadcn/ui Sidebar component (official docs): https://ui.shadcn.com/docs/components/radix/sidebar
- React Router v7 protected routes: https://blog.logrocket.com/authentication-react-router-v7/
- Supabase user_metadata.full_name from Google OAuth: https://github.com/orgs/supabase/discussions/4047
- Zustand persist security (no JWT in localStorage): https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data

---

*Stack research for: Our Cart v2.0 — Accounts & Multi-List*
*Researched: 2026-05-27*
