# Architecture Research

**Domain:** Authenticated multi-list shared grocery app (React SPA + Supabase Auth + multi-tenant lists)
**Researched:** 2026-05-27
**Confidence:** HIGH — all patterns verified against official Supabase docs, shadcn/ui docs, and confirmed code in the existing codebase

---

## Standard Architecture

### System Overview

```
Browser (Phone/Desktop)
  └── React SPA (Vite + React 19 + React Router v7)
        │
        ├── AuthProvider (React Context)
        │     └── onAuthStateChange → session/user state
        │
        ├── Router (createBrowserRouter)
        │     ├── / → redirects to /lists if logged in, else /login
        │     ├── /login → LoginPage (Google OAuth button)
        │     ├── /auth/callback → AuthCallbackPage (exchangeCodeForSession)
        │     ├── /lists → ListsPage (sidebar + list dashboard)  [PROTECTED]
        │     └── /list/:code → ListPage (existing, with sidebar)  [PROTECTED]
        │
        ├── AppShell (layout wrapper for authenticated routes)
        │     ├── Sidebar (shadcn Sheet — slide in from left on mobile)
        │     │     ├── UserProfile (display name + avatar)
        │     │     └── ListNav (list of user's lists, with active highlight)
        │     └── <Outlet /> (page content)
        │
        ├── Zustand Stores
        │     ├── authStore (session, user, loading, displayName)
        │     ├── listsStore (user's lists[], loading, create/rename/delete)
        │     └── itemsStore (existing — unchanged, tied to one list at a time)
        │
        └── Supabase client singleton (supabase.ts — existing, unchanged)

          ↕ HTTPS / WebSocket

Supabase (hosted)
  ├── Auth (Google OAuth provider)
  │     ├── auth.users (managed by Supabase — do not write directly)
  │     └── Google OAuth PKCE flow → session JWT
  ├── PostgreSQL
  │     ├── lists (+ owner_id, renamed/migrated)
  │     ├── list_members (join table: list_id + user_id + role)
  │     ├── items (existing — add added_by FK to auth.users later)
  │     └── profiles (public display name + avatar_url, trigger-created)
  ├── PostgREST API (REST reads/writes via session JWT)
  └── Realtime Server (WAL-based push — existing subscriptions work unchanged)
```

---

## Component Boundaries

### New Components (v2.0)

| Component | Responsibility | Where It Lives |
|-----------|---------------|----------------|
| `AuthProvider` | Wraps app, holds session+user in React Context, fires `onAuthStateChange` | `src/providers/AuthProvider.tsx` |
| `useAuth` hook | Reads auth context; any component needing user/session calls this | `src/hooks/useAuth.ts` |
| `authStore` (Zustand) | Persists session state outside React tree (for stores that need user ID) | `src/stores/authStore.ts` |
| `LoginPage` | Shows Google sign-in button, redirects after auth | `src/pages/LoginPage.tsx` |
| `AuthCallbackPage` | Handles `/auth/callback` redirect, calls `exchangeCodeForSession` | `src/pages/AuthCallbackPage.tsx` |
| `ProtectedRoute` | Wrapper that redirects to `/login` when no session | `src/components/ProtectedRoute.tsx` |
| `AppShell` | Layout for authenticated routes — contains sidebar + outlet | `src/components/AppShell.tsx` |
| `Sidebar` | shadcn Sheet (side="left") showing user profile + list navigation | `src/components/Sidebar.tsx` |
| `ListNav` | List of the user's lists; tapping navigates, active list highlighted | `src/components/ListNav.tsx` |
| `UserProfileSection` | Display name + avatar, edit button, sign-out | `src/components/UserProfileSection.tsx` |
| `ListsPage` | Dashboard when no list selected — "Create list" + list of all lists | `src/pages/ListsPage.tsx` |
| `ProfileEditDialog` | Inline dialog to rename display name | `src/components/ProfileEditDialog.tsx` |
| `listsStore` | Zustand store: fetch/create/rename/delete user's lists | `src/stores/listsStore.ts` |
| `SidebarToggleButton` | Hamburger icon in ListPage header to open/close sidebar | Part of ListPage header |

### Existing Components (modified)

| Component | Change Required | Why |
|-----------|----------------|-----|
| `router.tsx` | Add `/login`, `/auth/callback`, `/lists` routes; wrap existing routes in `ProtectedRoute` | All v1.0 routes become auth-required |
| `ListPage.tsx` | Remove `NamePromptDialog` (replaced by auth display name); add `SidebarToggleButton` in header; `addedBy` comes from `authStore` instead of `localStorage` | Auth replaces anonymous name prompt |
| `itemsStore.ts` | No data changes — `addedBy` param now comes from `authStore.user.displayName` rather than localStorage. Subscriptions work unchanged because session JWT is auto-sent to Realtime | Auth surfaces display name, subscription auth auto-handled |
| `uiStore.ts` | Keep `dismissedBanners` (for ShareBanner) — ShareBanner behavior TBD in v2 | Minimal change |
| `CreateListForm.tsx` | Add `owner_id: authStore.user.id` to INSERT; navigate to `/list/:code` (unchanged) | Lists now owned by a user |
| `LandingPage.tsx` | Replace or redirect — authenticated users go to `/lists`; unauthenticated see `/login` | Old landing page replaced by auth flow |

---

## Recommended Project Structure (delta from v1.0)

```
src/
├── providers/
│   └── AuthProvider.tsx        # NEW — React Context for session/user
├── hooks/
│   └── useAuth.ts              # NEW — reads AuthProvider context
├── stores/
│   ├── authStore.ts            # NEW — Zustand: session, user, displayName
│   ├── listsStore.ts           # NEW — Zustand: user's lists[]
│   ├── itemsStore.ts           # EXISTING — unchanged
│   └── uiStore.ts              # EXISTING — unchanged
├── pages/
│   ├── LoginPage.tsx           # NEW — Google sign-in button
│   ├── AuthCallbackPage.tsx    # NEW — handles /auth/callback redirect
│   ├── ListsPage.tsx           # NEW — list dashboard (no list selected)
│   ├── ListPage.tsx            # MODIFIED — auth-aware, sidebar toggle
│   ├── LandingPage.tsx         # REMOVED or redirect to /login
│   └── NotFoundPage.tsx        # EXISTING — unchanged
├── components/
│   ├── AppShell.tsx            # NEW — layout for all auth'd routes
│   ├── Sidebar.tsx             # NEW — shadcn Sheet, left side
│   ├── ListNav.tsx             # NEW — list of user's lists in sidebar
│   ├── UserProfileSection.tsx  # NEW — name + avatar + sign-out in sidebar
│   ├── ProfileEditDialog.tsx   # NEW — rename display name dialog
│   ├── ProtectedRoute.tsx      # NEW — auth guard wrapper
│   ├── CreateListForm.tsx      # MODIFIED — adds owner_id
│   ├── NamePromptDialog.tsx    # REMOVED — auth provides name
│   └── [all other existing components]  # UNCHANGED
└── lib/
    └── supabase.ts             # EXISTING — unchanged client singleton
```

---

## Architectural Patterns

### Pattern 1: Auth State via Context + Zustand Hybrid

**What:** React Context (`AuthProvider`) handles the `onAuthStateChange` subscription and pushes `session`/`user` to both Context and Zustand `authStore`. Components that need user info use `useAuth()` hook (reads Context). Zustand stores (`listsStore`, `itemsStore`) that need user ID call `authStore.getState()` directly.

**When to use:** When both React components AND non-React stores need auth state. Context alone can't serve stores; Zustand alone can't trigger re-renders ergonomically.

**Trade-offs:** Two places auth state lives is a tiny duplication, but the separation is clean — Context for component re-renders, Zustand for store-to-store communication. Acceptable for a 2-user app.

**Pattern:**
```typescript
// src/providers/AuthProvider.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initialize from existing session (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      useAuthStore.setState({ session, user: session?.user ?? null })
      setLoading(false)
    })

    // Listen for sign-in/sign-out/token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        useAuthStore.setState({ session, user: session?.user ?? null })
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Pattern 2: Google OAuth PKCE Flow (SPA-safe)

**What:** `signInWithOAuth` with `provider: 'google'` redirects to Google, then back to `/auth/callback`. The `AuthCallbackPage` calls `exchangeCodeForSession(code)` to complete the PKCE exchange. Supabase then manages the session JWT in localStorage automatically.

**When to use:** Always for SPAs — PKCE is safer than implicit flow (no token in URL fragment).

**Trade-offs:** Requires an `/auth/callback` route and one extra round-trip. Worth it for security. The implicit flow alternative is simpler but deprecated in OAuth 2.1.

**Configuration required:**
- Google Cloud Console: add `https://<project>.supabase.co/auth/v1/callback` as Authorized redirect URI
- Supabase dashboard → Auth → Providers → Google: enter Client ID + Secret
- Supabase dashboard → Auth → URL Configuration → Add `https://our-cart.vercel.app/auth/callback` to redirect allow list

**Pattern:**
```typescript
// LoginPage.tsx — trigger
async function handleGoogleSignIn() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}

// AuthCallbackPage.tsx — handle return
useEffect(() => {
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    supabase.auth.exchangeCodeForSession(code).then(() => {
      navigate('/lists', { replace: true })
    })
  }
}, [])
```

### Pattern 3: Protected Route Guard

**What:** A `ProtectedRoute` component wraps all authenticated routes. It reads `loading` and `session` from `AuthProvider`. While loading, render a spinner. If no session, redirect to `/login` preserving the intended destination.

**When to use:** Wrap every route that requires auth. In React Router v7, nest protected routes under a parent `ProtectedRoute` element.

**Pattern:**
```typescript
// src/components/ProtectedRoute.tsx
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}

// router.tsx — wrap all protected routes
{
  element: <ProtectedRoute />,
  children: [
    { path: '/lists', element: <AppShell><ListsPage /></AppShell> },
    { path: '/list/:code', element: <AppShell><ListPage /></AppShell> },
  ]
}
```

### Pattern 4: Mobile Sidebar via shadcn Sheet

**What:** Use shadcn/ui `Sheet` component (`side="left"`) as the sidebar on mobile. Open/close state lives in `uiStore` (or a boolean in `AppShell` — keep it local). On desktop, the sidebar can be always-visible (CSS `hidden md:flex` pattern).

**When to use:** Phone-first apps where a persistent sidebar would eat screen space. Sheet slides in over content, has built-in overlay/dismiss, and supports swipe-to-close on mobile (via Radix UI).

**Trade-offs:** Sheet adds a new shadcn component install (`npx shadcn@latest add sheet`). It does NOT use Vaul (gesture-driven drawer) — Sheet is dialog-based and simpler. Vaul would give swipe gestures but adds bundle size. For a 2-user app, Sheet is sufficient.

**Installation:** `npx shadcn@latest add sheet`

**Pattern:**
```typescript
// AppShell.tsx
const [sidebarOpen, setSidebarOpen] = useState(false)

<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent side="left" className="w-72 p-0">
    <Sidebar onNavigate={() => setSidebarOpen(false)} />
  </SheetContent>
</Sheet>

// In ListPage header — hamburger button
<button onClick={() => setSidebarOpen(true)}>
  <HamburgerIcon />
</button>
```

### Pattern 5: RLS for Authenticated Multi-List

**What:** All RLS policies switch from `anon` role to `authenticated` role and use `auth.uid()` to scope access. The `list_members` join table controls which users can access which lists. RLS on `items` checks membership via EXISTS subquery against `list_members`.

**When to use:** Any multi-tenant data model where users own/share resources.

**Trade-offs:** The EXISTS subquery in RLS runs on every row access — wrap `auth.uid()` in `(select auth.uid())` for Postgres optimizer caching. Performance is not a concern for 2 users but is good practice.

**Pattern:**
```sql
-- lists: owner can see/edit their own lists
create policy "Users can see lists they are members of"
  on lists for select to authenticated
  using (
    exists (
      select 1 from list_members
      where list_members.list_id = lists.id
        and list_members.user_id = (select auth.uid())
    )
  );

-- items: accessible only if user is a member of the list
create policy "Members can see list items"
  on items for select to authenticated
  using (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
        and list_members.user_id = (select auth.uid())
    )
  );
```

### Pattern 6: Profiles Table with Trigger

**What:** Supabase manages `auth.users` — you cannot write to it directly. Create a public `profiles` table that mirrors the user row, pre-populated via a trigger on `INSERT` to `auth.users`. This holds `display_name` (editable by user) and `avatar_url` from Google OAuth.

**When to use:** Whenever you need user-facing profile data that outlives a session. Google OAuth provides `full_name` in `raw_user_meta_data` — extract it in the trigger for a default display name.

**Pattern:**
```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  updated_at  timestamptz default now()
);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## Data Flow

### Flow 1 — App Startup (session restore)

```
App mounts
  → AuthProvider calls supabase.auth.getSession()
  → If session exists: set user in Context + authStore, render protected routes
  → If no session: redirect to /login
  → onAuthStateChange subscription starts (handles token refresh, tab sync)
```

### Flow 2 — Google Sign-In

```
User taps "Sign in with Google"
  → signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
  → Browser redirects to Google consent screen
  → Google redirects to https://<project>.supabase.co/auth/v1/callback
  → Supabase redirects to /auth/callback?code=xxx
  → AuthCallbackPage calls exchangeCodeForSession(code)
  → Session saved to localStorage by supabase-js
  → onAuthStateChange fires SIGNED_IN → Context + authStore updated
  → navigate('/lists', { replace: true })
```

### Flow 3 — Lists Load (user's lists)

```
ListsPage mounts
  → listsStore.fetchLists(userId)
  → SELECT * FROM lists JOIN list_members ON ... WHERE list_members.user_id = auth.uid()
  → RLS enforces: only lists where user is a member
  → Lists rendered in Sidebar + ListsPage
```

### Flow 4 — Create List (v2.0)

```
User creates list in CreateListForm
  → INSERT into lists (name, share_code, owner_id = auth.uid())
  → INSERT into list_members (list_id = new.id, user_id = auth.uid(), role = 'owner')
  → navigate('/list/:code')
  → listsStore refetches or optimistically appends
```

### Flow 5 — Share / Invite Partner to List (v2.0)

```
Owner taps "Share list"
  → App generates invite link: /invite/:invite_code
  → INSERT into list_invites (list_id, invite_code = nanoid(12), created_by = auth.uid())
  → Owner copies/shares invite link
  → Partner opens /invite/:invite_code
  → If not logged in: redirect to /login?redirect=/invite/:invite_code
  → After login: redeem invite → INSERT into list_members (list_id, user_id = auth.uid())
  → Partner navigate('/list/:code')
```

### Flow 6 — Real-time Sync (v2.0 — unchanged mechanism)

```
ListPage mounts, subscribeToList(list.id) called
  → supabase-js sends session JWT to Realtime automatically
  → Realtime evaluates RLS for authenticated user
  → Items events (INSERT/UPDATE/DELETE) delivered only if user is list member
  → itemsStore merge reducer runs — same as v1.0
```

### State Management

```
AuthProvider (React Context)
  ├── session: Session | null
  └── loading: boolean
      ↓ (passed to all components via useAuth())

authStore (Zustand)
  ├── session: Session | null
  ├── user: User | null
  └── displayName: string | null
      ↓ (read by itemsStore.addItem for addedBy, by AppShell for header)

listsStore (Zustand)
  ├── lists: List[]
  ├── loading: boolean
  └── actions: fetchLists, createList, renameList, deleteList
      ↓ (read by Sidebar/ListNav + ListsPage)

itemsStore (Zustand) — existing, no structural change
  ├── items: Item[]
  ├── syncStatus
  └── actions: addItem(listId, name, qty, category, addedBy)
                                                        ↑
                              read from authStore.displayName
```

---

## New Supabase Schema (v2.0)

### New and Modified Tables

```sql
-- MODIFIED: lists table (add owner_id)
alter table public.lists add column owner_id uuid references auth.users(id);

-- NEW: list_members (join table — who can access which list)
create table public.list_members (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  unique(list_id, user_id)
);

-- NEW: list_invites (invite codes for sharing)
create table public.list_invites (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists(id) on delete cascade,
  invite_code  text not null unique,
  created_by   uuid not null references auth.users(id),
  expires_at   timestamptz,
  accepted_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- NEW: profiles (public user data)
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz default now()
);
```

### Updated RLS Policies

```sql
-- DROP old anon policies (they allowed anonymous access)
drop policy if exists "anon_select_lists" on lists;
drop policy if exists "anon_insert_lists" on lists;
drop policy if exists "anon_select_items" on items;
drop policy if exists "anon_insert_items" on items;

-- LISTS: members can read, owners can insert/update/delete
create policy "Members can see their lists" on lists
  for select to authenticated
  using (
    exists (
      select 1 from list_members
      where list_members.list_id = lists.id
        and list_members.user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can create lists" on lists
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can update their lists" on lists
  for update to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners can delete their lists" on lists
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- LIST_MEMBERS: members can read their own memberships
create policy "Users can see memberships for their lists" on list_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- LIST_INVITES: owners can manage, anyone with code can read via RPC
create policy "Owners can manage invites" on list_invites
  for all to authenticated
  using (created_by = (select auth.uid()));

-- ITEMS: members can CRUD items on their lists
create policy "Members can see items" on items
  for select to authenticated
  using (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
        and list_members.user_id = (select auth.uid())
    )
  );

create policy "Members can add items" on items
  for insert to authenticated
  with check (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
        and list_members.user_id = (select auth.uid())
    )
  );

create policy "Members can update items" on items
  for update to authenticated
  using (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
        and list_members.user_id = (select auth.uid())
    )
  );

create policy "Members can delete items" on items
  for delete to authenticated
  using (
    exists (
      select 1 from list_members
      where list_members.list_id = items.list_id
        and list_members.user_id = (select auth.uid())
    )
  );

-- PROFILES: users can read all profiles (for showing partner name), update own
create policy "Anyone authenticated can see profiles" on profiles
  for select to authenticated using (true);

create policy "Users can update their own profile" on profiles
  for update to authenticated
  using ((select auth.uid()) = id);
```

---

## Route Changes

### v1.0 Routes

```
/              → LandingPage (create + join form)
/list/:code    → ListPage
*              → NotFoundPage
```

### v2.0 Routes

```
/              → redirect to /lists (if logged in) or /login (if not)
/login         → LoginPage (Google OAuth button)
/auth/callback → AuthCallbackPage (PKCE code exchange)
/invite/:code  → InviteRedemptionPage (accept invite → join list → redirect)
/lists         → ListsPage (list dashboard) [PROTECTED]
/list/:code    → ListPage [PROTECTED]
*              → NotFoundPage
```

**Router structure:**
```typescript
createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/invite/:code', element: <InviteRedemptionPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <Navigate to="/lists" replace /> },
      { path: '/lists', element: <AppShell><ListsPage /></AppShell> },
      { path: '/list/:code', element: <AppShell><ListPage /></AppShell> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```

---

## Integration Points

### What Does NOT Change (existing code safe)

| Piece | Reason |
|-------|--------|
| `itemsStore.ts` actions (add/update/delete/toggle/clear) | Still call the same Supabase tables; RLS changes are enforced by DB, not client code |
| Real-time `subscribeToList` + merge reducer | Supabase-js auto-sends session JWT to Realtime; RLS filters events by membership |
| `lib/supabase.ts` client singleton | Unchanged — auth session is stored in localStorage by supabase-js automatically |
| `ItemRow`, `CategorySection`, `AddItemBar`, `AutocompleteSuggestions` | Pure UI — no auth dependency |
| `ShareBanner` | May be repurposed as "Invite partner" banner; component structure unchanged |
| `SyncStatus` | Unchanged |
| `lib/categories.ts`, `lib/attribution.ts`, `lib/generateCode.ts` | Unchanged utility functions |
| Tailwind v4 + shadcn/ui setup | Unchanged; Sheet component added via CLI |

### What MUST Change Before Auth Works

1. **Remove `NamePromptDialog`**: Replace `localStorage`-based name with `authStore.user.displayName` sourced from `profiles.display_name`.
2. **Update `CreateListForm`**: Add `owner_id = auth.uid()` to INSERT and also insert into `list_members`.
3. **Update `addItem` call site** in `AddItemBar`/`ListPage`: `addedBy` comes from `authStore.displayName` not `localStorage`.
4. **RLS migration**: Old `anon` policies must be dropped BEFORE deploying v2.0 (otherwise existing anonymous lists become inaccessible anyway because they have no `owner_id`).

### Data Migration Consideration

Existing lists created in v1.0 have no `owner_id` and no `list_members` rows. These lists become inaccessible under v2.0 RLS. Accept this as a clean break — v1.0 was 2 days of internal testing. No migration needed.

---

## Suggested Build Order

The dependency graph drives this order. Each layer depends on the one below.

```
Phase 1: Auth Foundation
  1a. Supabase: Enable Google OAuth provider, configure redirect URLs
  1b. Database: Create profiles table + trigger, drop anon RLS, add v2.0 RLS
  1c. authStore (Zustand) — session/user state
  1d. AuthProvider (React Context) + useAuth hook
  1e. LoginPage + AuthCallbackPage
  1f. ProtectedRoute + update router.tsx
  → Gate: Can sign in with Google, session persists on refresh, unauthenticated → /login

Phase 2: Lists Infrastructure
  2a. Database: lists.owner_id column, list_members table, list_invites table
  2b. listsStore (Zustand) — fetch/create/rename/delete
  2c. ListsPage (dashboard — no list selected)
  2d. Update CreateListForm: insert owner_id + list_members row
  → Gate: Can create lists, lists appear on dashboard, RLS isolates user's lists

Phase 3: App Shell + Sidebar Navigation
  3a. Install shadcn Sheet: npx shadcn@latest add sheet
  3b. AppShell component (layout wrapper)
  3c. Sidebar component (Sheet left) with ListNav + UserProfileSection
  3d. SidebarToggleButton in ListPage header
  3e. ListNav navigation (tap list → navigate to /list/:code)
  → Gate: Sidebar opens, shows user's lists, navigation works on mobile

Phase 4: Auth Integration into ListPage
  4a. Remove NamePromptDialog from ListPage
  4b. Source addedBy from authStore.displayName (not localStorage)
  4c. ProfileEditDialog — edit display name → UPDATE profiles
  → Gate: Items attributed to user's profile name, no name prompt on load

Phase 5: List Sharing via Invite
  5a. InviteRedemptionPage (/invite/:code) — reads invite, inserts list_members
  5b. Invite link generation (in Sidebar or ListPage — INSERT list_invites)
  5c. Update ShareBanner or replace with "Invite partner" flow
  → Gate: Partner can accept invite link and see shared list
```

**Rationale:** Auth must come first because all other data is gated behind it. Lists store comes second because navigation depends on knowing which lists exist. Sidebar third because it's layout chrome that wraps existing content. Then the targeted cleanups (remove NamePromptDialog, add profile edit). Sharing last because it's the most complex flow and depends on everything else working.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling `supabase.auth.getUser()` on Every Route

**What people do:** Guard every protected component by calling `getUser()` inline.
**Why it's wrong:** Makes a network request to Supabase on every render. `getSession()` reads from localStorage synchronously — use it for initial load, then rely on `onAuthStateChange` for updates.
**Do this instead:** Call `getSession()` once in `AuthProvider` on mount. All components read from Context.

### Anti-Pattern 2: Storing Auth State Only in Zustand (No Context)

**What people do:** Put session/user in a Zustand store and read it from components with `useAuthStore`.
**Why it's wrong:** Works, but `onAuthStateChange` fires across tabs — React Context propagation ensures all components re-render correctly when session changes. Zustand doesn't batch React re-renders the same way.
**Do this instead:** Hybrid — Context for component re-renders, Zustand for store-to-store (itemsStore needs user ID for addedBy).

### Anti-Pattern 3: Dropping `anon` RLS Without a Transition Plan

**What people do:** Immediately drop all anon policies when switching to auth.
**Why it's wrong:** Any user with an existing v1.0 link hits a blank page or 404 because their session is `anon` and new RLS blocks everything.
**Do this instead:** For this app — accept the clean break. v1.0 was internal only. Document it and move on. For a public app, you'd run both policies temporarily.

### Anti-Pattern 4: Putting List Data in itemsStore

**What people do:** Add lists array to the existing `itemsStore` since it already knows about lists.
**Why it's wrong:** `itemsStore` is scoped to one list at a time (single channel subscription, single `list_id`). Mixing "all user's lists" into it creates a god store.
**Do this instead:** Separate `listsStore` for the list index. `itemsStore` manages items for the currently-active list only — unchanged from v1.0.

### Anti-Pattern 5: Using `supabase.auth.admin.inviteUserByEmail` for List Sharing

**What people do:** Use Supabase's built-in invite-by-email to share a list.
**Why it's wrong:** `inviteUserByEmail` is for inviting new users to the app (sends a magic link), not for sharing resources between existing users. Requires service role key (never expose client-side). Wrong tool for this use case.
**Do this instead:** Generate a `nanoid(12)` invite code, store in `list_invites` table, share the URL. Redemption page reads the invite and inserts into `list_members`.

### Anti-Pattern 6: Resubscribing to Realtime on Every `useEffect` Without Checking Auth

**What people do:** Call `subscribeToList` in `useEffect` without waiting for auth to be ready.
**Why it's wrong:** If `subscribeToList` fires before the session JWT is in the Supabase client, the Realtime connection is established without auth → RLS blocks all events → items never load.
**Do this instead:** Only subscribe when `!loading && session` (from `useAuth()`) AND `list` is loaded. The existing `useEffect([list])` guard in `ListPage` is correct — just add an auth readiness check.

---

## Scaling Considerations

This app is explicitly for 2 users. The architecture does not need to scale. For reference:

| Concern | At 2 users (target) | Notes |
|---------|---------------------|-------|
| Auth sessions | 2 active sessions | Free tier: unlimited auth users |
| list_members rows | 2 rows per list | No concern |
| RLS EXISTS subquery | Runs per row access | Cached per statement with `(select auth.uid())` — fine |
| Realtime with auth JWT | Same as v1.0 — session JWT auto-sent | Free tier 200 connections, we use 2 |
| Google OAuth rate limits | No concern at 2 users | Google allows 100 auth requests/user/minute |

---

## Sources

- [Supabase Google OAuth docs (official)](https://supabase.com/docs/guides/auth/social-login/auth-google) — signInWithOAuth, PKCE flow, redirectTo config
- [Supabase onAuthStateChange (official ref)](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) — events, session handling
- [Supabase Managing User Data (official)](https://supabase.com/docs/guides/auth/managing-user-data) — profiles table trigger pattern
- [Supabase RLS (official)](https://supabase.com/docs/guides/database/postgres/row-level-security) — auth.uid(), authenticated role, policy syntax
- [Supabase Realtime Postgres Changes (official)](https://supabase.com/docs/guides/realtime/postgres-changes) — RLS enforcement on Realtime events
- [Supabase Realtime Authorization (official)](https://supabase.com/docs/guides/realtime/authorization) — JWT session auto-sent to Realtime
- [shadcn/ui Sheet component (official)](https://ui.shadcn.com/docs/components/radix/sheet) — side prop, mobile drawer pattern
- [React Supabase auth template with protected routes (community)](https://dev.to/mmvergara/react-supabase-auth-template-with-protected-routes-41ib) — ProtectedRoute + React Router v7 pattern
- [Supabase team invite RLS pattern (community)](https://boardshape.com/engineering/how-to-implement-rls-for-a-team-invite-system-with-supabase) — list_members + invite code schema

---
*Architecture research for: Our Cart v2.0 — Auth + Multi-List*
*Researched: 2026-05-27*
