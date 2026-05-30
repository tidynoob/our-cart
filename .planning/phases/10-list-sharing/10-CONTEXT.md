# Phase 10: List Sharing - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning
**Mode:** `--auto` — Claude auto-selected the recommended option for every gray area. Review before planning. Auto-advancing to plan-phase.

<domain>
## Phase Boundary

This phase turns single-owner lists into **two-person shared lists** via a stable invite link. Today a `lists` row has one `owner_id` and RLS (`lists_auth.sql`, `items_auth.sql`) grants access only to that owner and only to a user's *own* items — so a partner who opens the existing `/list/:code` share URL reads **nothing** (RLS blocks the `share_code` lookup), and partners never see each other's items. Phase 10 introduces the **membership** primitive that makes the app's core value real: a partner redeems an invite link, is added to the list, and from then on **both people see and mutate the same items in real time**.

Delivers (ROADMAP Phase 10 success criteria):
1. Share button in the list header copies/shares an invite link (the ShareBanner already exists — its link target changes).
2. A partner who opens the invite link and signs in is added to the list and can see its items.
3. The invite link is stable — sharing it N times leads to the same list, never duplicate memberships.

Requirements: SHARE-01 (generate a shareable invite link), SHARE-02 (access it from a share button in the list header).

**Out of scope / deferred:**
- **Live cross-user profiles** (each partner seeing the *other's* current display name + avatar synced live) — deferred; partner items render via the existing Phase 9 `added_by` fallback. See Deferred Ideas + D-09.
- **>2 members, roles/permissions, leave/remove-member, revoke/rotate invite, invite expiry** — new capabilities, not in SHARE-01/02. Deferred.
- **Email/SMS invites** — link-only per SHARE-01. Deferred.
- **Claiming legacy anonymous (`owner_id IS NULL`) lists** — carried-forward Phase 7 deferral, untouched here.

</domain>

<decisions>
## Implementation Decisions

### Membership model — the access primitive (SHARE-01/02)
- **D-01:** Add a **`list_members` join table**: `(list_id uuid REFERENCES lists(id) ON DELETE CASCADE, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now(), PRIMARY KEY (list_id, user_id))`. The **composite PK gives idempotency for free** (a user can't have two membership rows for one list → directly satisfies success criterion 3). A join table (not a `partner_id` column on `lists`) is the clean model and costs nothing on free tier, even though the app targets 2 users.
- **D-02:** **Access = list owner OR row in `list_members`.** Rewrite the `lists` and `items` RLS policies (new migration; keep the existing files, add `list_members.sql` + a policy-rewrite migration — idempotent `DROP POLICY IF EXISTS` like the prior ones).
  - **`items` SELECT widens** from "own items only" (`user_id IS NULL OR auth.uid() = user_id`) to **"all items whose `list_id` is a list I own or am a member of."** This is the single change that makes partner items **visible**; INSERT/UPDATE/DELETE on items follow the same membership check so both people can add/check-off (the real-time shared-list value). Resolve via `items.list_id` (FK confirmed on `Item` type + `itemsStore` queries `.eq('list_id', listId)` and realtime `filter: list_id=eq.${listId}`).
  - **`lists` SELECT/UPDATE/DELETE widen** to owner-OR-member (retain legacy `owner_id IS NULL` branch). This also lets a member resolve the list by `share_code` in `ListPage` (`.eq('share_code', code)`, currently RLS-blocked for non-owners).
  - Keep the `(select auth.uid())` initPlan-optimization pattern from the existing migrations.
  - **Avoid RLS recursion:** the membership check used by `lists`/`items` policies (and `list_members`' own policies) must not recursively trigger `list_members` RLS — use a `SECURITY DEFINER` helper (e.g. `is_list_member(p_list_id)`) or an equivalent non-recursive `EXISTS`. Planner/researcher picks the exact form.
  - **`list_members` own RLS:** a user reads membership rows where `user_id = auth.uid()` (their own memberships); the list owner reads all memberships of their list. INSERTs come only through the redeem RPC (D-04), so direct member-insert can stay closed.

### Redemption route + join mechanism (SHARE-02, success criterion 2)
- **D-03:** **Dedicated protected route `/invite/:code`.** On mount (user authenticated), it calls the redeem RPC, then **redirects to `/list/:code`** (the canonical viewing URL, unchanged). Rationale: **pre-join the partner is not yet a member, so they cannot SELECT the list by `share_code` under RLS** (confirmed `ListPage` lookup returns nothing for non-members) — the join therefore needs a privileged path, and isolating it on its own route keeps join logic out of normal list viewing.
- **D-04:** Join via a **`redeem_invite(p_share_code text)` `SECURITY DEFINER` SQL function** (bypasses RLS to look up the list): find the list by `share_code`; if found, `INSERT INTO list_members (list_id, user_id) VALUES (..., auth.uid()) ON CONFLICT DO NOTHING`; return the list's `share_code`/`id`. **Idempotent** (PK + ON CONFLICT). Owner redeeming their own link → no-op insert, still redirects to the list. Unknown `share_code` → returns null → invite route shows a brief "invalid invite" state + link home.
- **D-05:** **Repoint the shared link to `/invite/:code`.** Change `ShareBanner` (`src/components/ShareBanner.tsx:14`) from `${origin}/list/${listCode}` to `${origin}/invite/${listCode}` so the copied/Web-Share link triggers redemption. One-line change; copy + Web Share buttons and the dismiss/re-expand behavior (Phase 9 D-11) are untouched.
- **D-06:** **No new auth-gate logic.** `/invite/:code` sits under the existing `ProtectedRoute`, which already stores `returnTo = pathname + search` in `sessionStorage` and survives OAuth (`ProtectedRoute.tsx:23`). Unauthenticated partner flow falls out for free: open invite → login → return to `/invite/:code` → join → `/list/:code`.

### Stable link / no duplicate memberships (success criterion 3)
- **D-07:** Idempotency is enforced at **two layers**: the `list_members` composite PK (D-01) and `ON CONFLICT DO NOTHING` in `redeem_invite` (D-04). The `share_code` is fixed on the list at creation (`listsStore.createList` → `nanoid(8)`), so the link never changes. Re-opening it any number of times = one membership, same list.

### Shared lists in the partner's sidebar
- **D-08:** **`listsStore.fetchLists` must return member lists, not just owned ones.** It currently filters `.eq('owner_id', userId)` — drop that filter and **rely on the new owner-OR-member RLS** to return all accessible lists (owned + joined), keeping `order('created_at', desc)`. Effect: a redeemed list appears automatically in the partner's sidebar — their home for navigating back to the shared list. (Planner confirms RLS returns member rows; falls back to an explicit `owner OR member` query only if needed.)

### Cross-user attribution / profiles — scope decision
- **D-09 [informational]:** **Defer the `profiles` table.** *(Deferral / do-not-build decision — intentionally not assigned to any Phase 10 plan; tracked here only so the reasoning survives. See Deferred Ideas.)* Once partner items become visible (D-02), they render through the existing **Phase 9 D-06 attribution fallback**: frozen `added_by` string + deterministic colored-initial badge (`src/lib/attribution.ts`). That already shows the partner's name on their items — enough for all three success criteria (none require live cross-user avatars). A `profiles` table for live cross-user name/avatar sync is **polish, not a success criterion**, so it stays out to keep this phase focused on membership + RLS + redemption and respect the $0 / simplicity constraints. Flagged as the immediate fast-follow. (Note: Phase 9 D-01 anticipated profiles "landing with Phase 10"; overriding because the success criteria don't need it and the fallback covers display.)

### Claude's Discretion
- Exact non-recursive membership-check shape (`SECURITY DEFINER is_list_member()` vs inline `EXISTS`) — planner/researcher picks; must not self-recurse on `list_members` RLS.
- Whether `redeem_invite` returns `share_code` or list `id` for the post-join redirect — either lands on `/list/:code`.
- `/invite/:code` UX while joining (spinner) and invalid-invite copy — minimal, phone-first.
- Whether the owner is also written as a `list_members` row at list creation (uniform membership) or stays owner-only via `owner_id` — both satisfy the owner-OR-member policies; planner decides.
- `fetchLists`: pure RLS reliance vs explicit `.or(owner, member)` query — RLS reliance recommended; planner confirms member rows return.
- Realtime: confirm members receive item realtime events (RLS-gated broadcast via `setAuth`, Phase 6 D-08) — researcher verifies; expected to work once items SELECT widens.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Requirements
- `.planning/ROADMAP.md` §Phase 10 — Goal + 3 success criteria (share button / partner joins via link & sees items / stable idempotent link)
- `.planning/REQUIREMENTS.md` — SHARE-01, SHARE-02; Out of Scope table
- `.planning/PROJECT.md` — Core value ("two people see the same list update in real-time"); $0-budget / 2-user / phone-first / simplicity constraints

### Prior Phases (what this builds on)
- `.planning/phases/09-auth-integration-into-listpage/09-CONTEXT.md` — **D-06 attribution fallback** (the exact seam that renders partner items via `added_by` + colored initials — why profiles can defer, D-09); explicit "profiles table → Phase 10" deferral note
- `.planning/phases/07-lists-infrastructure/07-CONTEXT.md` — `listsStore`, `lists.share_code` (nanoid(8)), owner-scoped fetch (the `.eq('owner_id')` filter D-08 removes)
- `.planning/phases/06-auth-foundation/06-CONTEXT.md` — RLS `(select auth.uid())` pattern; `ProtectedRoute` returnTo redirect (D-06); `onAuthStateChange` + `realtime.setAuth` (member realtime)

### Reusable Code (read before building)
- `src/components/ShareBanner.tsx` — share-URL construction at **line 14** (repoint to `/invite/` per D-05); copy + Web Share buttons reused as-is
- `src/pages/ListPage.tsx` — list resolution by `share_code` at **lines 98-113** (`.eq('share_code', code)`, RLS-blocked for non-members today); ShareBanner render + dismiss/re-expand at **lines 296-372**
- `src/components/auth/ProtectedRoute.tsx` — `returnTo` sessionStorage at **line 23** (the plumbing `/invite/:code` rides, D-06)
- `src/router.tsx` — add `/invite/:code` route (D-03); note `/list/:code` lives under `ProtectedRoute > AppShell`
- `src/stores/listsStore.ts` — `fetchLists` `.eq('owner_id', userId)` to change (D-08); `createList` already mints `share_code` (nanoid(8)) — stable-link source (D-07)
- `src/stores/itemsStore.ts` — `.eq('list_id', listId)` fetch + realtime `filter: list_id=eq.${listId}` (the membership join key for items RLS, D-02)
- `src/types/list.ts` — `List` (`id`, `share_code`, `owner_id`); `src/types/item.ts` — `Item.list_id` (the FK items RLS joins on)

### Database / RLS (the policies to rewrite — read before touching access)
- `supabase/migrations/lists_auth.sql` — current owner-only `lists` policies (widen to owner-OR-member, D-02)
- `supabase/migrations/items_auth.sql` — current own-items-only `items` policies (widen SELECT to "items in accessible lists", D-02) — **this is the change that makes partner items visible**
- New: `list_members` table + RLS migration + `redeem_invite` SECURITY DEFINER function (D-01/D-02/D-04)

### Technology
- `CLAUDE.md` §Technology Stack — React 19, Vite 8, Supabase (`@supabase/supabase-js` 2.106.1), Zustand, Tailwind v4, `lucide-react`, **`nanoid`** (share_code). **Corrections (prior phases):** routing is `react-router-dom` **v7**; UI primitives are `@base-ui/react` ^1.5.0 (not Radix/shadcn).
- Supabase RPC + `SECURITY DEFINER` (privileged redeem): https://supabase.com/docs/guides/database/functions
- Supabase RLS + realtime authorization: https://supabase.com/docs/guides/database/postgres/row-level-security

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ShareBanner` already builds + copies + Web-Shares a list link — Phase 10 only **repoints the target** (`/list/` → `/invite/`, D-05); no new share UI (SHARE-02 mostly satisfied already).
- `lists.share_code` (nanoid(8)) already minted at `createList` — the stable invite identifier (D-07); nothing new to generate.
- `ProtectedRoute` already preserves the intended path through OAuth via `returnTo` — the unauthenticated-partner redemption flow needs no new redirect code (D-06).
- Existing RLS migrations are idempotent (`DROP POLICY IF EXISTS`) and use the `(select auth.uid())` optimization — the new policy-rewrite migration mirrors that style (D-02).
- Phase 9 D-06 attribution fallback already renders any item from `added_by` + colored initials — partner items display correctly with **zero** attribution work (D-09).

### Established Patterns
- Zustand stores own server/auth-derived state (`listsStore`, `itemsStore`, `authStore`); components are prop-driven. Redemption is a thin route component calling an RPC, not new store state (or a small `joinList` action — planner decides).
- RLS is the access boundary; app queries lean on policies rather than re-filtering (D-08 removes the redundant `owner_id` filter once RLS is membership-aware).
- Realtime auth flows from `realtime.setAuth` (Phase 6 D-08) so RLS-gated broadcast Just Works for authorized users — members inherit item realtime once SELECT widens (D-02).

### Integration Points
- `supabase/migrations/*` — new `list_members` table, rewritten `lists`/`items` policies, `redeem_invite` function (D-01/D-02/D-04).
- `src/router.tsx` — new `/invite/:code` route (D-03).
- New `src/pages/InvitePage.tsx` (or similar) — calls redeem RPC on mount, redirects to `/list/:code` (D-03/D-04).
- `src/components/ShareBanner.tsx:14` — repoint URL (D-05).
- `src/stores/listsStore.ts` — `fetchLists` returns owned + member lists (D-08); optional `joinList`/redeem action.
- `src/stores/itemsStore.ts` — unchanged in code, but its reads/realtime now serve members once items RLS widens (D-02) — researcher verifies realtime.

</code_context>

<specifics>
## Specific Ideas

- The whole point of the app finally turns on here: until membership exists, "shared list" is cosmetic (the ShareBanner hands out a link RLS refuses). D-02's items-SELECT widening is the keystone — verify partners can both see **and** check off items.
- One stable link, not per-invite tokens: the list's `share_code` IS the invite (D-07). Simpler than minting/expiring tokens, and idempotency falls out of the membership PK.
- Reuse the existing share link UI; just change where it points (D-05). Don't build a second share surface.
- Redemption is a privileged hop (`SECURITY DEFINER` RPC, D-04) precisely because RLS correctly hides the list from a not-yet-member — don't try to "open up" `lists` SELECT to make the lookup work; that would leak every list by guessable code.

</specifics>

<deferred>
## Deferred Ideas

- **`profiles` table for live cross-user name/avatar** (D-09) — so each partner sees the *other's* current display name + avatar (not the frozen `added_by` snapshot) on shared-list items. The Phase 9 D-06 fallback chain is the exact seam a profiles lookup slots into for non-self items. Immediate fast-follow; not required by Phase 10's success criteria.
- **Membership management** — leave list, owner removes a member, revoke/rotate the invite code, invite expiry, >2 members, roles/permissions. New capabilities → own phase(s).
- **Non-link invites** (email/SMS) — SHARE-01 is link-only.
- **Claim legacy anonymous (`owner_id IS NULL`) lists/items** — carried-forward Phase 7/9 deferral, untouched.

</deferred>

---

*Phase: 10-List Sharing*
*Context gathered: 2026-05-30*
