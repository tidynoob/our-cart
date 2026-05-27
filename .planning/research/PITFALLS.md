# Pitfalls Research

**Domain:** Adding Google OAuth + multi-list + sharing to existing anonymous single-list app
**Researched:** 2026-05-27
**Confidence:** HIGH

> This document covers v2.0 milestone pitfalls only: auth migration, RLS, Google OAuth, multi-list,
> sidebar navigation, and list sharing. For v1.0 real-time sync pitfalls (WebSocket disconnection,
> fetch-before-subscribe, free tier pausing, etc.), see git history for the v1.0 version of this file.

---

## Critical Pitfalls

---

### Pitfall 1: Enabling RLS on Existing Tables Locks Out All Existing Data

**What goes wrong:**
The `items` and `lists` tables currently have no RLS. When you run `ALTER TABLE items ENABLE ROW LEVEL SECURITY` as part of the v2.0 migration, all existing rows immediately become invisible to the anon role — even in queries where no user is authenticated. The app silently returns empty results instead of erroring. The existing list data from v1.0 appears to be gone.

**Why it happens:**
PostgreSQL's RLS default is deny-all when no policies exist. Supabase tables with RLS enabled and zero policies return zero rows for all non-superuser roles. The SQL Editor runs as the Postgres superuser and bypasses RLS — so testing in the dashboard will show data, but the client SDK will not. This creates a false sense that everything is fine.

**How to avoid:**
Write RLS policies in the same migration file as the `ENABLE ROW LEVEL SECURITY` statement — never enable RLS in one step and add policies later. Define policies for the `authenticated` role immediately. During the migration phase, also decide explicitly what to do with orphaned v1.0 data (rows with no `user_id`): either bulk-assign them, archive them, or write a temporary permissive policy to allow transition-period access.

**Warning signs:**
- Running `ALTER TABLE items ENABLE ROW LEVEL SECURITY` without a following `CREATE POLICY` in the same file.
- Testing by querying in the Supabase SQL editor and seeing data, then assuming the client will too.
- No explicit plan for what happens to existing `items` rows that have no `user_id`.

**Phase to address:** Auth foundation phase (first phase of v2.0). The RLS enablement must happen atomically with policy creation.

---

### Pitfall 2: Existing `items` Rows Have No `user_id` — Migration Strategy Is Required

**What goes wrong:**
The current `items` table has `list_id` and `added_by` (a display name string), but no `user_id` foreign key to `auth.users`. When you add `user_id` as a column and enforce it with RLS policies like `(select auth.uid()) = user_id`, all existing rows fail the policy check and become invisible.

**Why it happens:**
v1.0 used anonymous access — there was no concept of a user UUID. Now v2.0 needs ownership. Adding the column is straightforward; migrating the data is not, because there is no mapping from the old `added_by` string to a real `auth.users.id`.

**How to avoid:**
Pick one explicit migration strategy before writing any SQL:
1. **Assign to first owner**: When the first authenticated user claims a list (e.g., by entering a v1.0 share code), bulk-set all existing `items.user_id` for that list to that user's UUID.
2. **Null means shared**: Make `user_id` nullable and write policies that allow `user_id IS NULL OR user_id = (select auth.uid())`. This lets old rows stay visible while new rows are attributed.
3. **Archive v1.0 data**: Accept that existing data is unowned, export it as a backup, and start fresh.

For this app (2-person household, single active list), option 2 is the lowest-friction migration.

**Warning signs:**
- Adding `user_id uuid REFERENCES auth.users(id) NOT NULL` to existing tables without a backfill plan.
- RLS policy uses `user_id = (select auth.uid())` on a table where most rows have NULL `user_id`.

**Phase to address:** Auth foundation phase. Must be resolved before any RLS policy is written.

---

### Pitfall 3: Google OAuth Redirects to `localhost` in Production (or Production in Local Dev)

**What goes wrong:**
After Google's OAuth callback, Supabase redirects to the Site URL configured in the Supabase dashboard. If Site URL is set to `http://localhost:5173` (the Vite default), production users land on localhost after sign-in. Conversely, if Site URL is the production URL, local development OAuth callbacks redirect to Vercel and break the local session. Both make OAuth completely non-functional in one environment.

**Why it happens:**
Supabase uses the Site URL as the fallback redirect when no `redirectTo` is passed to `signInWithOAuth()`. The Supabase dashboard has a single Site URL field. Vercel preview deployments add a third URL to the matrix: the preview deployment URL (`*.vercel.app`) is neither localhost nor the production domain, but OAuth redirects need to work there too.

**How to avoid:**
In Supabase Dashboard → Auth → URL Configuration:
- Set **Site URL** to the production domain: `https://our-cart.app` (or whatever the Vercel production URL is).
- Add to **Redirect URLs allowlist** (with wildcard `**` suffix for multi-level path support):
  - `http://localhost:5173/**`
  - `https://*-mitchellgriffin.vercel.app/**` (adjust for the actual Vercel account slug)
  - The production domain: `https://our-cart.app/**`

In the app code, always pass an explicit `redirectTo` when calling `signInWithOAuth()`, computed from `window.location.origin`, so it adapts to whichever environment is running.

In Google Cloud Console → OAuth Client → Authorized redirect URIs, add the Supabase callback URL for the project: `https://<project-id>.supabase.co/auth/v1/callback`. Authorized JavaScript origins should include both `http://localhost:5173` and the production domain.

**Warning signs:**
- `signInWithOAuth({ provider: 'google' })` called without a `redirectTo` parameter.
- Supabase Site URL is still `http://localhost:5173`.
- Google Cloud Console only has one Authorized redirect URI (either localhost or production, not both).
- OAuth works in one environment but fails in the other.

**Phase to address:** Auth foundation phase — must be configured before the first OAuth test.

---

### Pitfall 4: Auth State Flash on Page Load (Unauthenticated UI Shown Before Session Resolves)

**What goes wrong:**
On page load, `supabase.auth.getSession()` is asynchronous. Before the session resolves, protected routes render as if the user is unauthenticated. The user sees the sign-in page (or a redirect flash) for 200–500ms before being shown the authenticated view. On mobile, this is visually jarring. In React Router, if the redirect fires before `onAuthStateChange` emits `INITIAL_SESSION`, the user is bounced to `/login` and then immediately back to the list — a double navigation.

**Why it happens:**
`supabase.auth.onAuthStateChange` fires the `INITIAL_SESSION` event after the async session check completes. React Router evaluates route guards synchronously on render. If the auth context has not resolved yet, the guard sees `user: null` and redirects to login — then the session resolves, updates the context, and triggers a second navigation back.

**How to avoid:**
Introduce an `isLoading` state in the auth context that starts `true` and becomes `false` only after `INITIAL_SESSION` fires. Protected routes must render `null` or a spinner (not a redirect) while `isLoading` is true. The guard logic is: `if (isLoading) return <Spinner />`, then `if (!user) return <Navigate to="/login" />`.

```tsx
// AuthContext pattern
const [session, setSession] = useState<Session | null>(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session)
      setLoading(false)
    }
  )
  return () => subscription.unsubscribe()
}, [])
```

Do NOT make the `onAuthStateChange` callback async — it causes deadlock in the token refresh mechanism when `TOKEN_REFRESHED` events are processed.

**Warning signs:**
- `onAuthStateChange` callback is marked `async`.
- Protected route guard has no loading state — it checks `user === null` and redirects immediately.
- Users report a brief flash of the login screen before landing on the list.

**Phase to address:** Auth foundation phase — the AuthContext is the first thing built.

---

### Pitfall 5: RLS Policies Written Without `WITH CHECK` on INSERT/UPDATE

**What goes wrong:**
A `USING` clause on a SELECT/UPDATE policy controls which rows a user can *read*. The `WITH CHECK` clause on INSERT/UPDATE controls what a user can *write*. Without `WITH CHECK` on INSERT, an authenticated user can insert a row with any arbitrary `user_id` (including another user's UUID). Without `WITH CHECK` on UPDATE, a user can change the `user_id` on a row they own, effectively stealing ownership.

**Why it happens:**
Developers think in terms of "what can the user see" (SELECT), not "what can the user write". RLS documentation examples often focus on SELECT. The Supabase dashboard's Policy editor sometimes auto-generates USING clauses without WITH CHECK.

**How to avoid:**
Every INSERT policy needs `WITH CHECK ((select auth.uid()) = user_id)`. Every UPDATE policy needs both `USING ((select auth.uid()) = user_id)` and `WITH CHECK ((select auth.uid()) = user_id)`.

Additionally: a SELECT policy is required on a table before UPDATE will work at all. If UPDATE isn't working, check for a missing SELECT policy first.

Example for `items` table:
```sql
-- SELECT: users see items in lists they belong to
CREATE POLICY "items_select" ON items
  FOR SELECT USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = (select auth.uid()))
  );

-- INSERT: users can only insert items with their own user_id
CREATE POLICY "items_insert" ON items
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id AND
    list_id IN (SELECT list_id FROM list_members WHERE user_id = (select auth.uid()))
  );

-- UPDATE: users can only update their own items
CREATE POLICY "items_update" ON items
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

**Warning signs:**
- Policies use `USING` but no `WITH CHECK`.
- Testing only checks that SELECT returns the right rows, not that INSERT rejects bad user_id values.

**Phase to address:** Auth foundation phase — write policies correctly from the start.

---

### Pitfall 6: Using `auth.uid()` Directly in RLS Policies (Performance Trap)

**What goes wrong:**
RLS policies with `auth.uid() = user_id` (unwrapped) force PostgreSQL to evaluate `auth.uid()` for every row scanned, rather than once per query. On the `items` table at even moderate size, this causes sequential scans instead of index seeks. The pattern `(select auth.uid()) = user_id` tells the Postgres query planner to treat it as a constant per query (initPlan), enabling index use.

**Why it happens:**
The unwrapped form looks identical and works correctly — it's just slow. Performance degradation is invisible until the table has significant rows, which won't happen during development.

**How to avoid:**
Always write `(select auth.uid())` not `auth.uid()` in policy expressions. Also create indexes on every column referenced in policies: `CREATE INDEX ON items(list_id)`, `CREATE INDEX ON items(user_id)`, `CREATE INDEX ON list_members(user_id, list_id)`.

Supabase's Performance Advisor in the dashboard flags unindexed RLS columns — run it after writing policies.

**Warning signs:**
- Policy body contains `auth.uid()` not `(select auth.uid())`.
- No explicit index on `user_id` or `list_id` in the items/lists tables.
- Supabase Performance Advisor shows "RLS policy references unindexed column" warnings.

**Phase to address:** Auth foundation phase when writing policies. Can be retrofitted but better to get right initially.

---

### Pitfall 7: Realtime Channel Does Not Inherit Auth Session Automatically After Login

**What goes wrong:**
The existing `itemsStore.ts` creates a Supabase Realtime channel using the global `supabase` client. In v1.0, the channel used the anon role (no auth). In v2.0 with RLS on, the channel needs to authenticate with the user's JWT. If the channel is created before the user signs in, or if the JWT expires and the channel is not refreshed, the Realtime connection silently drops to zero rows (RLS blocks all events).

Specifically: Realtime caches the access policy for the duration of the channel connection. If the user logs in after the channel is opened, the channel will continue operating under the unauthenticated context until it is explicitly refreshed or the channel is recreated.

**Why it happens:**
The `supabase` client automatically manages auth tokens for REST calls (it re-reads the session for each HTTP request). Realtime is different: the JWT is passed once at connection time, and policy changes (including login) only take effect when the client sends a new JWT via `realtime.setAuth()` or reconnects.

**How to avoid:**
- Listen to `onAuthStateChange` and call `supabase.realtime.setAuth(session.access_token)` whenever the session changes (login, token refresh, logout).
- When the user logs out, call `supabase.realtime.setAuth(null)` to drop back to anon.
- In `itemsStore.subscribeToList`, always call `unsubscribe()` and recreate the channel after an auth state change, not just on list navigation.

**Warning signs:**
- Realtime subscription is opened before the auth session is confirmed.
- `onAuthStateChange` does not trigger a channel refresh or `setAuth` call.
- Items stop appearing after the JWT access token expires (default: 1 hour).

**Phase to address:** Auth foundation phase — must be part of the AuthContext design, not patched later.

---

### Pitfall 8: List Sharing RLS Allows Invitation Table to Be Read by Anyone

**What goes wrong:**
List sharing requires an invitation mechanism: a share code or link that lets a second user join a list. The `list_invitations` table needs to be readable by unauthenticated (or not-yet-joined) users to process the invite. If RLS is written naively as `SELECT ... WHERE user_id = (select auth.uid())`, the invited user cannot read their invitation (they don't yet have `user_id` set on the row). If RLS is disabled entirely on the invitations table, all invitations are publicly readable.

**Why it happens:**
This is a documented pattern specific to Supabase invitation systems. The invitation exists before the user accepts it, so the user ID is not yet known. Developers either open the table (security hole) or lock it completely (invitation flow breaks).

**How to avoid:**
Use a `SECURITY DEFINER` function to expose invitation data by token only — the function accepts the invite token and returns the matching invitation row, bypassing RLS in a controlled way because only the specific row matching the token is returned. UUID tokens are non-guessable, so single-record exposure is safe.

```sql
CREATE OR REPLACE FUNCTION get_invitation(invite_token uuid)
RETURNS list_invitations
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM list_invitations WHERE token = invite_token LIMIT 1;
$$;
```

For the `list_members` table (which grants ongoing access), a standard RLS policy based on `user_id` is correct and safe.

**Warning signs:**
- `list_invitations` table has `SELECT TO authenticated USING (true)` or no RLS at all.
- Invitation flow assumes the invited user is already in `auth.users` before they click the link.

**Phase to address:** List sharing phase. The invitation schema must use this pattern from the start.

---

### Pitfall 9: `getSession()` Used for Authorization Decisions Instead of `getUser()`

**What goes wrong:**
`supabase.auth.getSession()` reads the JWT from localStorage without making a network call and without verifying the token's authenticity. A tampered or stolen token would pass `getSession()`. For display-only purposes (rendering the user's name) this is fine. For authorization decisions (is this user allowed to delete this list?), it is a security vulnerability.

**Why it happens:**
`getSession()` is faster (no network call) and simpler. Developers use it everywhere because it works 99% of the time. The distinction from `getUser()` is subtle and not obvious from the function name.

**How to avoid:**
Use `getUser()` for any check that gates access to data or a destructive action. Use `getSession()` only for non-critical UI state (display name, avatar). For this SPA, the pattern is: `onAuthStateChange` provides the session for UI rendering; `getUser()` is called when an action touches the database (though RLS on the Supabase side is the real security layer — `getUser()` is defense in depth on the client).

**Warning signs:**
- Every auth check in the app uses `getSession()`, including ones that gate navigation or mutations.
- No use of `getUser()` anywhere in the codebase.

**Phase to address:** Auth foundation phase — establish the pattern in the AuthContext before any feature work.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Null `user_id` on old items instead of backfill | No data migration needed | Items visible to all list members regardless of who added them (correct for this use case, actually) | Acceptable — v1.0 items are shared household data |
| Storing display name in `user_metadata` instead of a separate `profiles` table | Simpler schema | `user_metadata` can be updated by the user directly; not suitable for authorization, and hard to join | Only for initial draft; move to `profiles` table before shipping |
| Single `supabase` client instance in `lib/supabase.ts` | Simple, no change needed | Token state is global — if multiple tabs have different auth states, all share one session | Acceptable for a 2-person app where concurrent sessions are rare |
| Hardcoded redirect URL in `signInWithOAuth()` | Quicker to write | Breaks in preview deployments or if the domain changes | Never — always use `window.location.origin` |
| Skipping the `profiles` table and storing name in `auth.users.user_metadata` | One less table | user_metadata is user-writable and cannot be secured with RLS | Never for any data used in authorization |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth + Google OAuth | Not configuring Authorized JavaScript Origins in Google Cloud Console separately from Redirect URIs | Both must be set: Origins = app domain, Redirect URI = `<project>.supabase.co/auth/v1/callback` |
| Supabase Realtime + Auth | Opening channel before user is authenticated, then wondering why RLS blocks events | Open channel after `INITIAL_SESSION` fires; call `realtime.setAuth()` on each auth state change |
| Supabase RLS + Postgres Changes | RLS blocks DELETE payloads from including full row data — `payload.old` only has primary key when RLS is enabled | The existing `itemsStore.ts` already handles this correctly: `(oldRow as { id?: string }).id` — preserve this pattern |
| Vercel + Supabase OAuth | Preview deployment URLs (`*.vercel.app`) not in Supabase redirect allowlist | Add wildcard pattern `https://*-<account-slug>.vercel.app/**` to Supabase allowed redirect URLs |
| Supabase Auth + `onAuthStateChange` | Making the callback `async` | Remove all async calls from the callback; it causes deadlock during token refresh |
| Google Cloud Console + OAuth | Adding restricted scopes (anything beyond email + profile + openid) | Only request `email`, `profile`, `openid` — restricted scopes trigger a Google verification process that takes weeks |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `auth.uid()` unwrapped in RLS policies | Queries slow as items table grows | Use `(select auth.uid())` always | Noticeable at ~10K rows; invisible during development |
| Subquery in RLS SELECT policy not indexed | List membership check is a sequential scan on `list_members` | Index `list_members(user_id)` and `list_members(list_id)` | At 10+ lists per user |
| Fetching all lists for sidebar then filtering client-side | Extra data transferred; slow initial load | Use RLS + server-side filter: `SELECT * FROM lists WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())` | Negligible for 2-person app, but wrong pattern |
| Re-creating Realtime channel on every auth state change event | Excessive reconnections if auth state changes rapidly | Debounce or gate channel recreation: only recreate if `user.id` actually changed | Any rapid sign-in/sign-out cycle |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing sensitive data in `user_metadata` (user-writable) | User can self-escalate permissions by editing metadata if any RLS policy reads from it | Store role/permission data only in `app_metadata` (server-writable) or a separate `profiles` table with RLS |
| Exposing invite tokens in URL query params that get logged by analytics | Invite links can be replayed by anyone who sees the logs | Use short-lived invite tokens; expire after 24 hours or first use |
| Not enabling RLS on the `profiles` table | Any authenticated user can read/write any user's profile | Enable RLS on `profiles` with `(select auth.uid()) = id` for all operations |
| Using the Supabase service role key in client code | Full database bypass — any user gets superuser access | Service role key never in frontend; anon key only in client |
| Allowing any authenticated user to join any list by knowing the list UUID | No isolation between users' lists | List membership must be explicit: user must be in `list_members` to access a list |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring sign-in before explaining what the app does | Bounce rate on landing page; users don't understand why they need an account | Show value (screenshot/description) on landing page; sign-in is secondary |
| Google OAuth popup blocked by mobile Safari | Users see nothing happen after tapping "Sign in with Google" | Use redirect flow (`redirectTo`) instead of popup on mobile; Supabase defaults to this |
| After sign-in, user lands on home page instead of the list they came from | Disorienting; breaks invite flow (user clicked an invite link, got bounced to login, now can't find the list) | Store `returnTo` URL before redirecting to login; restore after OAuth callback |
| Sidebar opening on every list navigation (no persistence) | Sidebar state resets constantly; feels broken on mobile | Persist sidebar open/closed state in localStorage; remember it across page loads |
| Sign-out without confirmation | Partner accidentally signs out while shopping | Require confirmation for sign-out; recovering requires phone + Google auth again |

---

## "Looks Done But Isn't" Checklist

- [ ] **RLS enabled**: Verify in Supabase dashboard that ALL tables (items, lists, list_members, profiles, list_invitations) show "RLS enabled". The SQL Editor won't reveal missing policies.
- [ ] **OAuth redirect working in all environments**: Test sign-in on localhost, on a Vercel preview URL, and on the production domain. All three must complete without redirect errors.
- [ ] **INSERT WITH CHECK present**: Verify that INSERT policies have a `WITH CHECK` clause — not just `USING`. Missing this allows any user to insert rows with arbitrary `user_id`.
- [ ] **Existing v1.0 data visible**: After migration, verify that items created in v1.0 (no `user_id`) are still visible to the authenticated user who claimed the list.
- [ ] **Token refresh doesn't break Realtime**: Let a session run for >1 hour, then confirm Realtime is still receiving events. `onAuthStateChange` with `TOKEN_REFRESHED` must call `realtime.setAuth()`.
- [ ] **Sidebar shows correct lists**: After switching users (sign out, sign in as other user), sidebar must show only the new user's lists — not a mix of both users' data from cache.
- [ ] **`(select auth.uid())` not `auth.uid()`**: Grep all migration SQL files for bare `auth.uid()` in USING/WITH CHECK clauses. Replace with wrapped form.
- [ ] **Invitation flow tested with brand-new account**: An invite link must work for a user who has never opened the app before — not just for an existing user.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS enabled without policies (data locked out) | LOW | In Supabase SQL editor: `CREATE POLICY "temp_open" ON items FOR ALL USING (true)` — then immediately write proper policies and remove temp policy |
| OAuth redirecting to wrong URL | LOW | Update Site URL and Redirect URLs in Supabase Auth dashboard; no code change needed |
| Existing v1.0 data invisible after migration | MEDIUM | Write a data migration: `UPDATE items SET user_id = '<owner_uuid>' WHERE user_id IS NULL AND list_id = '<list_id>'` for each affected list |
| Auth state flash in production (user sees login page briefly) | LOW | Add `isLoading` guard to protected route; one code change, one deploy |
| Realtime events stop after 1 hour | MEDIUM | Add `supabase.realtime.setAuth(session.access_token)` to `onAuthStateChange` handler; requires retesting Realtime subscription lifecycle |
| Invitation security hole (table fully open) | HIGH | Immediately enable RLS on invitations table; implement SECURITY DEFINER function pattern; may require invite links to be re-issued |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RLS enabled without policies (P1) | Auth foundation | Run integration test as authenticated user: confirm items are visible |
| v1.0 data migration strategy (P2) | Auth foundation | Verify all pre-migration items visible in app after migration runs |
| Google OAuth redirect misconfiguration (P3) | Auth foundation | Test sign-in on localhost, preview URL, and production URL before any other feature work |
| Auth state flash / isLoading guard (P4) | Auth foundation | Hard-reload the list page while signed in; must not flash the login screen |
| Missing WITH CHECK on INSERT/UPDATE policies (P5) | Auth foundation | Attempt to POST an item with a fabricated `user_id` — must be rejected |
| Unwrapped `auth.uid()` in policies (P6) | Auth foundation | Grep all SQL migration files; run Supabase Performance Advisor |
| Realtime channel not inheriting auth (P7) | Auth foundation | Sign in, open list, wait 61 minutes, add item on device 2 — must appear on device 1 |
| Invitation table RLS hole (P8) | List sharing phase | Attempt to read all invitations without a token — must return empty or error |
| `getSession()` for authorization (P9) | Auth foundation | Code review: confirm `getUser()` is used in any auth-gating logic |

---

## Sources

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — USING vs WITH CHECK, auth.uid() caching pattern (HIGH confidence)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — (select auth.uid()) vs auth.uid() benchmarks (HIGH confidence)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) — policy caching, setAuth(), JWT expiration behavior (HIGH confidence)
- [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) — Vercel wildcard patterns, Site URL configuration (HIGH confidence)
- [Google oauth redirects to localhost on production · supabase Discussion #25756](https://github.com/orgs/supabase/discussions/25756) — real-world redirect misconfiguration (HIGH confidence)
- [Google OAuth redirect URL with Vercel Preview URLs — Vercel Community](https://community.vercel.com/t/google-oauth-redirect-url-with-vercel-preview-urls-supabase/6345) — Vercel-specific patterns (MEDIUM confidence)
- [Login with Google | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-google) — Authorized JavaScript Origins vs Redirect URIs, required scopes (HIGH confidence)
- [Supabase auth.getSession vs auth.getUser — GitHub Discussion #4400](https://github.com/orgs/supabase/discussions/4400) — security difference between the two (HIGH confidence)
- [Security and performance risk with getUser and getSession · Issue #898](https://github.com/supabase/auth-js/issues/898) — official acknowledgment of getSession insecurity server-side (HIGH confidence)
- [How to implement RLS for a team invite system with Supabase](https://boardshape.com/engineering/how-to-implement-rls-for-a-team-invite-system-with-supabase) — SECURITY DEFINER function pattern for invitations (MEDIUM confidence)
- [Supabase RLS: Common Mistakes and CVE-2025-48757](https://vibeappscanner.com/supabase-row-level-security) — RLS disabled by default, real-world exposure incidents (MEDIUM confidence)
- [onAuthStateChange API Reference](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) — INITIAL_SESSION timing, async callback deadlock (HIGH confidence)
- [Realtime delete event not containing all old data when RLS enabled · Discussion #12471](https://github.com/orgs/supabase/discussions/12471) — DELETE payload only contains PK when RLS on (HIGH confidence — already handled in itemsStore.ts)
- [Race condition between isAuthenticated and isLoading — auth0-react Issue #343](https://github.com/auth0/auth0-react/issues/343) — auth state flash / double redirect pattern (MEDIUM confidence)

---
*Pitfalls research for: v2.0 Auth + Multi-List migration on existing anonymous grocery list app*
*Researched: 2026-05-27*
