# Phase 9: Auth Integration into ListPage - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning
**Mode:** `--auto` — Claude auto-selected the recommended option for every gray area. Review before planning. Auto-advancing to plan-phase.

<domain>
## Phase Boundary

This phase makes the list experience reflect **who the signed-in user is**. It replaces the v1.0 anonymous-identity model (per-list name typed into `NamePromptDialog`, cached in `localStorage`, frozen onto each item as `added_by`) with the **authenticated Google identity** already established in Phase 6. After this phase: the user's Google avatar + display name appear in the sidebar profile slot; their own items show that avatar/name; they can edit their display name and watch their existing item attributions update live; they can sign out from inside the app; and a dismissed share-code header can be brought back without a page refresh.

Requirements: PROF-01 (edit display name), PROF-02 (Google avatar in sidebar + item attribution), PROF-03 (sign out), NAV-03 (re-expand dismissed share header).

**Out of scope (other phases / deferred):**
- **Cross-user / partner attribution.** PROF-02 here is scoped to **items the current user added** (success criterion 1 says "on items they have added"). The `items` SELECT RLS policy (`user_id IS NULL OR auth.uid() = user_id`, `supabase/migrations/items_auth.sql`) means a user can only read their own items + legacy unowned items — partner items aren't even visible until **Phase 10 (List Sharing)** introduces shared membership. A cross-user **`profiles` table** (so each person can read the *other's* name/avatar) is therefore a **Phase 10** concern, not this phase. See Deferred Ideas.
- **List sharing / invite links** — Phase 10.
- **Email/password auth, anonymous-access preservation as a feature** — out of scope per REQUIREMENTS.md (carried from Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Display-name & avatar source (PROF-01, PROF-02)
- **D-01:** Store the editable display name in **Supabase auth `user_metadata`** (`supabase.auth.updateUser({ data: { display_name } })`) — **no new `profiles` table this phase**. Rationale: Phase 9's attribution scope is the current user's own items, and `user_metadata` is readable for the current user straight from `authStore.user`. A `profiles` table is only needed when the *partner's* name/avatar must be readable cross-user — that lands with sharing (Phase 10). Keeps Phase 9 at $0 / zero new tables / minimal surface.
- **D-02:** **Seed** the display name from Google on first use: read `user.user_metadata.full_name` (fallback `name`, then email local-part) as the initial display name. The avatar URL comes from `user.user_metadata.avatar_url` (fallback `picture`). Both are populated by Google OAuth automatically — no migration needed.
- **D-03:** Add an `updateDisplayName(name)` action to `authStore` that calls `supabase.auth.updateUser({ data: { display_name } })` and updates the store's `user` optimistically so the UI reflects the change immediately. Trim + require non-empty (reuse existing name-input validation tone).

### Rename → existing-attribution propagation (PROF-01, success criterion 2)
- **D-04:** **Derive the current user's item attribution live from their auth display name**, matched by `item.user_id === user.id` — do NOT bulk-rewrite the frozen `added_by` strings on existing rows, and do NOT run a migration to backfill names. Because attribution for own items reads from `authStore.user` (live), editing the display name (D-03) makes **all** the user's existing item attributions update instantly with zero DB writes. This is the clean way to satisfy "see it update on their existing item attributions."
- **D-05:** Add `user_id: string | null` to the `Item` TS type (`src/types/item.ts`) and ensure it's selected (`fetchItems` already uses `select('*')`, so the column already arrives — just type it). The DB column already exists with `DEFAULT auth.uid()` (`items_auth.sql`), so new items are auto-owned server-side.
- **D-06:** Keep writing `added_by` (a snapshot of the current display name) on new-item insert as the **fallback / legacy** attribution source. Attribution resolution order per item: (1) if `item.user_id === currentUser.id` → live auth display name + Google avatar; (2) else → frozen `added_by` string + colored-initial badge (existing behavior); (3) null → the existing "?" unknown badge. (Order (2) is also the seam Phase 10 upgrades to a profiles lookup for partner items.)

### Avatar in attribution badges (PROF-02)
- **D-07:** Extend `AttributionBadge` to optionally accept an `avatarUrl`. When present, render the Google avatar as a rounded `<img>` (same `h-7 w-7` footprint as the initial badge) with the existing `aria-label="{name} added this"`; on missing/failed image, fall back to the deterministic colored-initial badge. The colored-initial path (`src/lib/attribution.ts`) stays untouched as the fallback. No layout change to `ItemRow` beyond passing the new prop.

### Profile UI + sign-out (PROF-01, PROF-03)
- **D-08:** Build the profile section into the existing **Sidebar profile slot** (`<div data-slot="profile-slot">` at `src/components/Sidebar.tsx:82`, left there by Phase 8 D-01). Contents: avatar + display name, an inline **edit-name** affordance (pencil → inline `Input` + Save/Cancel, mirroring the `ListPage` list-rename inline pattern at `ListPage.tsx:314-333`), and a **Sign out** button. Sidebar must receive `user` (pass from `AppShell`, which already reads `authStore.user`) — keep `Sidebar` prop-driven, consistent with how it currently receives `lists`.
- **D-09:** **Sign out** calls `authStore.signOut()` (already implemented, `authStore.ts:58`). No confirmation dialog — low-stakes, 2-user app, sign-in is one tap. On sign-out `user` becomes `null`; the existing `ProtectedRoute` (Phase 6 D-05/D-06) redirects `/list/:code` → `/` (login). Close the sidebar drawer as part of the action so it isn't left open over the login screen.
- **D-10:** **Retire `NamePromptDialog` + the per-list `localStorage` name** for authenticated users. In the auth era every user has a Google identity, so the "type your name" prompt is redundant and the `AddItemBar`-disabled-until-named guard (`ListPage.tsx:368`, `userName === null`) is replaced by the always-present auth display name. `AddItemBar`'s `addedBy` becomes the auth display name. (`NamePromptDialog.tsx` and its test can be removed; the planner confirms no other consumer.)

### Re-expand dismissed share header (NAV-03)
- **D-11:** Add a `restoreBanner(listCode)` action to `uiStore` that removes the code from the `dismissedBanners` Set (currently dismissal is one-way — `uiStore.ts`). When the banner is dismissed, `ListPage` shows a small persistent **"Show share code"** affordance in the header row (icon button, e.g. `lucide-react` `Share2`/`QrCode`, co-located near the hamburger/title) that calls `restoreBanner` → banner reappears with no refresh (success criterion 4). The affordance is visible only while the banner is dismissed.

### Claude's Discretion
- Exact avatar fallback chain field names (`avatar_url` vs `picture`, `full_name` vs `name`) — read what Google actually returns and pick robustly; planner/researcher confirms.
- Inline-edit vs tiny dialog for display-name editing inside the sidebar — inline is recommended (D-08) but planner may use a compact dialog if the slot is too cramped on small screens; keep it phone-first.
- Icon + exact placement of the "show share code" re-expand affordance (D-11) — keep it minimal and within the existing header row; don't add a second toolbar.
- Whether `AddItemBar` reads the display name from `authStore` directly or receives it as a prop from `ListPage` — planner decides; prop-passing matches the current `addedBy` prop.
- Avatar image loading/error handling (broken URL, slow load) — graceful fallback to initials; planner decides spinner vs instant-fallback.
- Whether to keep the `added_by` write on insert (D-06) as display-name snapshot or also stamp it for Phase-10 readiness — keep writing it; it's the fallback + the Phase 10 seam.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Requirements
- `.planning/ROADMAP.md` §Phase 9 — Goal + 4 success criteria (avatar in sidebar + on own items / edit display name updates existing attributions / sign out → login / re-expand dismissed share header); §Phase 10 (List Sharing — why cross-user attribution + `profiles` table are deferred)
- `.planning/REQUIREMENTS.md` — PROF-01, PROF-02, PROF-03, NAV-03 (this phase); Out of Scope table
- `.planning/PROJECT.md` — v2.0 Active scope ("Editable user profile / display name", "Header re-expand — way to bring back dismissed header/code banner"); $0-budget / 2-user / phone-first constraints
- `.planning/STATE.md` §Accumulated Context — locked auth/RLS conventions; "Sidebar before Profile — AppShell layout hosts profile section" (the slot this phase fills)

### Prior Phases (what this builds on)
- `.planning/phases/06-auth-foundation/06-CONTEXT.md` — D-07 (`authStore` shape: `user`/`session`/`signOut`); D-08 (`onAuthStateChange` non-async + `realtime.setAuth`); D-09/D-10 (`items.user_id` nullable + RLS); D-05/D-06 (`ProtectedRoute` redirect-to-`/` on null user — the sign-out landing)
- `.planning/phases/08-app-shell-sidebar/08-CONTEXT.md` — D-01/D-07 (AppShell hosts the profile slot; LandingPage stays shell-less); D-02/D-03 (Sidebar drawer pattern + local open state — the drawer to close on sign-out)
- `.planning/phases/07-lists-infrastructure/07-CONTEXT.md` — `listsStore` / owner-scoped lists (context for the sidebar the profile slot lives in)

### Reusable Code (read before building)
- `src/stores/authStore.ts` — `user` (carries `user_metadata.avatar_url`/`full_name`), `signOut()` already implemented; **add** `updateDisplayName` (D-03)
- `src/components/Sidebar.tsx` — the `data-slot="profile-slot"` at **line 82** (D-08); prop-driven (`lists`) pattern to mirror for `user`
- `src/components/AppShell.tsx` — already reads `authStore.user` and renders `<Sidebar>`; pass `user` down (D-08)
- `src/components/AttributionBadge.tsx` + `src/lib/attribution.ts` — badge to extend with optional avatar (D-07); colored-initial fallback stays
- `src/components/ItemRow.tsx` — renders `AttributionBadge` from `item.added_by` at **lines 252-261**; the "?" unknown badge fallback (D-06)
- `src/types/item.ts` — add `user_id` (D-05)
- `src/stores/itemsStore.ts` — `addItem` (currently omits `user_id`; DB DEFAULT fills it); `added_by` snapshot write (D-06)
- `src/components/AddItemBar.tsx` — `addedBy` prop becomes the auth display name (D-10)
- `src/pages/ListPage.tsx` — `NamePromptDialog` usage at **line 293**, `localStorage` name at **lines 128-131**, `AddItemBar` disabled guard at **line 368** (all retired per D-10); ShareBanner render/dismiss at **lines 284-290** + inline-rename pattern at **lines 314-333** (reuse for D-08/D-11)
- `src/components/ShareBanner.tsx` — `onDismiss` prop (D-11)
- `src/stores/uiStore.ts` — `dismissedBanners` Set + one-way `dismissBanner`; **add** `restoreBanner` (D-11)
- `src/components/NamePromptDialog.tsx` — to retire (D-10)

### Database / RLS (read before touching attribution)
- `supabase/migrations/items_auth.sql` — `items.user_id uuid DEFAULT auth.uid()`; SELECT policy `user_id IS NULL OR (select auth.uid()) = user_id` (**why partner items aren't visible pre-Phase-10**, why own-item attribution is the Phase 9 scope)
- `supabase/migrations/lists_auth.sql` — lists RLS (context only)

### Technology
- `CLAUDE.md` §Technology Stack — React 19, Vite 8, Supabase (`@supabase/supabase-js` 2.106.1), Zustand, Tailwind v4, `lucide-react`. **Corrections (from prior phases):** routing is `react-router-dom` **v7**; UI primitive lib is `@base-ui/react` ^1.5.0 (not Radix/shadcn).
- Supabase Auth `updateUser` (user_metadata): https://supabase.com/docs/reference/javascript/auth-updateuser

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authStore.user.user_metadata` already carries Google `avatar_url` + `full_name` post-OAuth — no fetch needed for the current user's avatar/name (D-02).
- `authStore.signOut()` is implemented and wired to `ProtectedRoute` redirect — sign-out (D-09) is mostly UI work, not new auth logic.
- `Sidebar` profile slot is pre-built and empty (Phase 8 deliberately left it) — D-08 fills it.
- `AttributionBadge` + deterministic color palette (`src/lib/attribution.ts`) — the avatar (D-07) augments, not replaces, this; initials remain the fallback.
- `ListPage` inline list-rename (lines 314-333) — copy-able pattern for inline display-name editing (D-08).
- `uiStore.dismissedBanners` Set — already gates the banner; only needs an inverse action (D-11).

### Established Patterns
- Zustand stores own server/auth-derived state; components own ephemeral UI state. `authStore` is the home for `updateDisplayName` (D-03).
- Stores expose actions; UI calls them and reflects optimistically (matches `listsStore.renameList`).
- Components are prop-driven where the data lives at shell level (`Sidebar` gets `lists` from `AppShell`; add `user` the same way).
- Tailwind v4 mobile-first; 44px tap targets; `@base-ui/react` Dialog for any modal.

### Integration Points
- `src/types/item.ts` — add `user_id` (D-05).
- `src/stores/authStore.ts` — add `updateDisplayName` (D-03).
- `src/stores/uiStore.ts` — add `restoreBanner` (D-11).
- `src/components/AttributionBadge.tsx` — optional `avatarUrl` prop + img/initials fallback (D-07).
- `src/components/ItemRow.tsx` — resolve attribution: own item (user_id match) → auth name+avatar; else `added_by` (D-06). Needs current `user.id` + display name + avatar (from `authStore`).
- `src/components/Sidebar.tsx` — fill profile slot with avatar/name/edit/sign-out; accept `user` prop (D-08/D-09).
- `src/components/AppShell.tsx` — pass `user` to `Sidebar` (D-08).
- `src/pages/ListPage.tsx` — remove `NamePromptDialog` + localStorage name + AddItemBar disabled guard (D-10); add "show share code" re-expand affordance (D-11); feed `AddItemBar.addedBy` from auth display name.
- `src/components/AddItemBar.tsx` — `addedBy` = auth display name (D-10).

</code_context>

<specifics>
## Specific Ideas

- The identity shift is the heart of this phase: v1.0 "type a name per list" → v2.0 "you ARE your Google account." Treat `NamePromptDialog`/localStorage name as legacy to remove, not preserve (D-10).
- "Updates existing attributions" should feel like magic with zero DB churn — derive own-item attribution live from auth state (D-04), don't migrate `added_by`.
- Re-expand (NAV-03) is a small affordance, not a new panel — bring the existing banner back, don't build a second share UI (D-11).
- Sign-out is one tap, no confirm — it's cheap to undo (sign back in) and the app is private 2-user (D-09).
- Phone-first: profile section sits at the bottom of the slide-in drawer; avatar + name + actions must hit 44px tap targets.

</specifics>

<deferred>
## Deferred Ideas

- **`profiles` table for cross-user name/avatar** — so each partner can see the *other's* current display name + avatar on shared-list items. Belongs with **Phase 10 (List Sharing)**, when partner items first become visible (the items SELECT RLS + sharing membership land there). The D-06 attribution fallback chain is the exact seam where a profiles lookup slots in for non-self items.
- **Bulk-rewrite / backfill of `added_by`** — explicitly rejected (D-04); live derivation makes it unnecessary. Only revisit if Phase 10 needs denormalized partner names for offline/perf reasons.
- **Claim legacy anonymous (`user_id = NULL`) items into a user's identity** — related to Phase 7's deferred "claim legacy lists." Not needed for Phase 9; legacy items keep their frozen `added_by` + initial badge via the D-06 fallback.

</deferred>

---

*Phase: 9-Auth Integration into ListPage*
*Context gathered: 2026-05-29*
