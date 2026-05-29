# Phase 8: App Shell & Sidebar - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning
**Mode:** `--auto` — Claude auto-selected the recommended option for every gray area. Review before planning. Auto-advancing to plan-phase.

<domain>
## Phase Boundary

This phase delivers the **navigation shell**: a slide-in sidebar drawer, openable from any list page, that lists all the signed-in user's lists, visually marks the currently viewed list, and navigates+closes on tap. It introduces an `AppShell` layout (React Router layout route) that hosts the drawer + its trigger and wraps the protected list route, plus a `Sidebar` drawer component built on the existing `@base-ui/react` Dialog primitive.

Requirements: NAV-01 (open slide-in sidebar showing all lists), NAV-02 (current list visually highlighted).

**Out of scope (other phases):**
- **Profile section** (avatar, display name, sign out) lives inside this shell but is **Phase 9** (PROF-01/02/03). Phase 8 leaves a slot in the shell — does NOT build profile UI. (STATE.md: "Sidebar before Profile — AppShell layout hosts profile section.")
- **Re-expand dismissed share header** (NAV-03) is Phase 9.
- **Invite links / sharing / cross-user list membership** are Phase 10. The sidebar shows only `owner_id = user.id` lists (the `listsStore.fetchLists` query is already owner-scoped from Phase 7); no shared lists exist yet.
- **No realtime on the `lists` table** — single-session reflection of create/rename/delete is sufficient pre-sharing (carried from Phase 7 D-06). A list created in another session won't live-appear in the sidebar; it appears on next fetch/refresh.

</domain>

<decisions>
## Implementation Decisions

### Shell architecture
- **D-01:** Introduce an `AppShell` component mounted as a **React Router layout route** (renders `<Outlet/>`) wrapping the protected `/list/:code` route. The hamburger trigger and the `Sidebar` drawer are rendered ONCE at shell level, not per-page. This gives criterion-1 "from any list page" for free and is the host Phase 9 profile slots into. Nest it under the existing `ProtectedRoute` element route so auth-gating is preserved. **Note for planner:** this repo is on **React Router v7** (`react-router-dom` ^7.15.1) — CLAUDE.md still says "v6"; layout routes / `<Outlet/>` / `createBrowserRouter` all work in v7, plan against v7.
- **D-07:** **LandingPage stays as-is — no shell, no hamburger.** It is already the full lists-home (shows all lists, create affordance, rename/delete). Adding the drawer there would be redundant. The sidebar is a *switching* affordance for when you are inside a list. Criterion 1 ("from any list page") is satisfied by `/list/:code` pages only.

### Drawer primitive
- **D-02:** Build the drawer on the existing `@base-ui/react` **Dialog primitive** (the same primitive `src/components/ui/dialog.tsx` already wraps) — NOT a new component library, NOT the centered `DialogContent` (which hardcodes `top-1/2 left-1/2 -translate-*` centering). Create a new left-anchored drawer component (`Sidebar` and, if the planner wants a reusable shell, a thin `Drawer`/`Sheet` styled variant). Reuse the primitive's built-in focus-trap, Escape-to-close, backdrop, and portal. Animate the slide-in with `tw-animate-css` (already a dependency) via `data-open`/`data-closed` state classes, mirroring the existing dialog's `data-open:animate-in` approach. **Zero new dependencies.**

### Sidebar open/close state
- **D-03:** Sidebar open state is **local `useState` in `AppShell`** — NOT `uiStore`. The trigger and the drawer both live inside `AppShell`, so there are no cross-component consumers; `uiStore` is reserved for state read across unrelated components (e.g. `dismissedBanners`). Keep it local and simple.

### Active-list highlight (NAV-02)
- **D-04:** Identify the current list by matching the route param `useParams().code` against each list's `share_code` (URL identity is `share_code` per Phase 7 D-01). Apply a visual-distinct treatment (background + heavier font weight) AND set `aria-current="page"` on the active row for accessibility. Do NOT match by `list.id` (the URL carries `share_code`, not `id`).

### Lists data loading on list pages
- **D-05:** `AppShell` calls `listsStore.fetchLists(user.id)` on mount when `lists` is empty. Today `fetchLists` is only invoked by `LandingPage`; a user who deep-links or refreshes directly on `/list/:code` never populated `listsStore.lists`, which would render an empty sidebar. Guard on empty so navigating list→list doesn't refetch. Read `user.id` from `authStore`.

### Layout responsiveness (criterion 4)
- **D-06:** **One overlay drawer at all breakpoints** — slides over content on both mobile and desktop. Do NOT build a persistent desktop rail / two-layout split. Phone-first, matches "slide-in sidebar," and eliminates the layout-break risk criterion 4 guards against. Constrain drawer width (e.g. `w-72`/`max-w-[80vw]`) so it never spans a wide desktop viewport.

### Close-on-navigate (criterion 3)
- **D-08:** Tapping a list row navigates AND closes the drawer in one handler — a `Link` to `/list/:share_code` with an `onClick` that sets the shell's open state to `false`. Tapping the already-active list still closes the drawer (no-op navigation is fine).

### Claude's Discretion
- Trigger affordance: hamburger (`Menu` icon from `lucide-react`, already a dep) placement in the list header — co-locate with the existing `ListPage` header row (name + `SyncStatus`). Planner/UI decides exact position (likely leading-left).
- Whether to extract a generic reusable `Drawer`/`Sheet` styled wrapper vs. inline the drawer styling directly in `Sidebar` — planner decides; keep it minimal, one consumer for now.
- Sidebar header/title text and empty-state copy (user owns zero lists — unlikely on a list page but possible). Reuse lists-home tone.
- Exact slide direction/easing/duration — left-anchored slide-in is expected; tune with `tw-animate-css`.
- Whether the hamburger/shell also appears on `NotFoundPage` — no (it's outside the protected list route).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope & Requirements
- `.planning/ROADMAP.md` §Phase 8 — Goal + 4 success criteria (drawer from any list page / active list distinct / tap navigates+closes / mobile+desktop no break); §Phase 9 (profile + NAV-03 scope boundary for D-07); §Phase 10 (sharing — why sidebar is owner-only)
- `.planning/REQUIREMENTS.md` — NAV-01, NAV-02 (this phase); NAV-03 + PROF-01/02/03 (Phase 9, out of scope); Out of Scope table (no >2 members, no granular permissions)
- `.planning/STATE.md` §Accumulated Context — "Sidebar before Profile — AppShell layout hosts profile section" (drives D-01/D-07 forward-compat); RLS + store conventions

### Prior Phase (Phase 7 — the data layer this consumes)
- `.planning/phases/07-lists-infrastructure/07-CONTEXT.md` — D-01 (`share_code` is URL identity → drives D-04), D-03 (`listsStore` is the sidebar's data source), D-05 (owner-scoped `fetchLists` query), D-06 (no realtime on `lists`)

### Reusable Code (read before building)
- `src/components/ui/dialog.tsx` — the `@base-ui/react` Dialog wrapper to model the drawer on (D-02); shows the `data-open:animate-in` / `tw-animate-css` pattern and portal/backdrop usage
- `src/router.tsx` — current `createBrowserRouter`; `ProtectedRoute` element route wraps `/list/:code`. AppShell layout route nests here (D-01)
- `src/stores/listsStore.ts` — `lists` + `fetchLists(userId)` (sidebar data, D-05)
- `src/stores/uiStore.ts` — ephemeral-UI Zustand pattern (the boundary D-03 deliberately does NOT cross)
- `src/stores/authStore.ts` — `user.id` for `fetchLists` (D-05)
- `src/pages/ListPage.tsx` — header row (name + `SyncStatus`) where the hamburger trigger co-locates; `useParams().code` for active match (D-04)
- `src/pages/LandingPage.tsx` — the lists-home that stays unchanged (D-07); its list-row rendering is a styling reference for sidebar rows

### Technology
- `CLAUDE.md` §Technology Stack — React 19, Tailwind v4, Zustand, `lucide-react`. **Correction:** routing is `react-router-dom` **v7** (per `package.json`), not v6 as CLAUDE.md states; primitive lib is `@base-ui/react` ^1.5.0 (not Radix).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@base-ui/react` Dialog primitive (via `src/components/ui/dialog.tsx`): focus-trap, Escape, backdrop, portal — re-skin left-anchored for the drawer (D-02). Do NOT reuse the centered `DialogContent`.
- `listsStore.lists` / `fetchLists`: the sidebar's data source; already owner-scoped (D-05).
- `lucide-react` `Menu` icon for the trigger; `tw-animate-css` for slide animation — both already deps.
- `LandingPage` list-row markup (`<Link to={/list/:share_code}>` + truncate) — styling reference for sidebar rows.

### Established Patterns
- Stores own server data + mutations; pages/components own ephemeral UI state (D-03 keeps drawer-open local).
- Dialog animation via `data-open:animate-in` / `data-closed:animate-out` state classes + `tw-animate-css`.
- Tailwind v4 mobile-first; constrained max-widths.
- Routes are `share_code`-based; `ProtectedRoute` is the existing layout-route precedent for nesting `AppShell`.

### Integration Points
- `src/router.tsx` — add `AppShell` layout route (renders `<Outlet/>`) nested under `ProtectedRoute`, wrapping `/list/:code` (D-01).
- New `src/components/AppShell.tsx` (or `src/layouts/`) — hosts trigger + `Sidebar`, owns open `useState` (D-03), calls `fetchLists` on mount when empty (D-05).
- New `src/components/Sidebar.tsx` — left-anchored drawer on the Dialog primitive (D-02); maps `listsStore.lists`, active match via `useParams().code` (D-04), navigate+close on tap (D-08).
- `src/pages/ListPage.tsx` — header gains the hamburger trigger (rendered by shell or passed down); rest unchanged.

</code_context>

<specifics>
## Specific Ideas

- "Slide-in sidebar drawer" = overlay, not a persistent rail — one layout for all widths (D-06). Phone-first.
- The sidebar is the polished navigation surface Phase 7 deliberately deferred ("the drawer is the real navigation surface and lands next phase" — Phase 7 specifics). It consumes the same `listsStore` data the plain lists-home already proved out.
- Forward-compat: build the shell with a clear, empty region for the Phase 9 profile section (avatar/name/sign-out) — leave the slot, don't fill it.

</specifics>

<deferred>
## Deferred Ideas

- **Profile section in the shell** (avatar, display name editing, sign out) — Phase 9 (PROF-01/02/03). Shell leaves the slot.
- **Re-expand dismissed share-code header** (NAV-03) — Phase 9.
- **Persistent desktop sidebar rail** — explicitly rejected for this phase (D-06). Could revisit if desktop usage grows, but phone-first overlay is the call now.
- **Realtime sidebar updates across sessions/users** — belongs with Phase 10 (List Sharing), when cross-user membership first exists (carried from Phase 7 D-06).

None of these are in-scope for Phase 8; recorded so they aren't lost.

</deferred>

---

*Phase: 8-App Shell & Sidebar*
*Context gathered: 2026-05-29*
