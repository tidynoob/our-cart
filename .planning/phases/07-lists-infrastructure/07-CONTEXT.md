# Phase 7: Lists Infrastructure - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Mode:** Recommendations applied — user delegated all four gray areas ("go with your recommendations"). Review before planning.

<domain>
## Phase Boundary

This phase delivers the multi-list foundation: a `listsStore` (Zustand) and database CRUD for **owned, named lists** — create, rename, delete — plus the route structure and a minimal lists-home page so all four success criteria are demonstrable. After this phase, a signed-in user owns named lists, can create/rename/delete them, and each list is a navigable destination.

Requirements: LIST-01 (create named list), LIST-02 (rename), LIST-03 (delete with confirmation).

**Out of scope (other phases):** The slide-in **sidebar drawer** and active-list highlighting are Phase 8 — this phase builds the data + a plain lists-home page the sidebar will later consume, not the drawer UX. User profile / display name / avatar are Phase 9. Invite links, share buttons, and partner access to a list are Phase 10. Until Phase 10 ships, a user only sees lists they own — there is no cross-user list membership yet.

</domain>

<decisions>
## Implementation Decisions

### List URL identity (LIST-01, routing)
- **D-01:** Keep `share_code` as the URL identifier — routes stay `/list/:code`. Reuses `ListPage`, `CreateListForm`, `itemsStore` (which already resolves `share_code` → `list.id`) with zero rewrite, and keeps Phase 10 sharing trivial (the share URL *is* the list URL). Do NOT switch URLs to the list `id`. `share_code` remains `nanoid(8)`, generated in the create handler.

### UI scope — Phase 7 vs Phase 8 (LIST-01/02/03)
- **D-02:** Phase 7 ships a **minimal lists-home page** (the authenticated `/` view) that lists the current user's lists with a create affordance and per-list rename + delete controls. This is a real, non-throwaway destination ("a navigable destination" — success criterion 1). It is NOT the slide-in sidebar — Phase 8 layers the drawer + active highlighting on top of the same `listsStore` data. Keep the lists-home visually plain; polish/drawer is Phase 8.
- **D-03:** Introduce a `listsStore` (Zustand) mirroring the `itemsStore`/`authStore` pattern: owns the user's list collection + CRUD actions (`fetchLists`, `createList`, `renameList`, `deleteList`). `ListPage` keeps its existing fetch-by-`share_code` for direct navigation and legacy lists; the planner may have it read from `listsStore` cache when present, but the by-`share_code` path must remain.

### List ownership on create (LIST-01, fixes Phase 6 tech debt)
- **D-04:** On list creation, set `owner_id = auth.uid()` explicitly in the `listsStore.createList` action. This closes the Phase 6 tech-debt gap (authed users creating via the unchanged v1.0 `CreateListForm` produced `owner_id = NULL`). Planner may additionally add a DB `DEFAULT auth.uid()` on `lists.owner_id` as defense-in-depth (mirrors `items.user_id`) — planner's call.
- **D-05:** The lists-home queries only the user's own lists: `select ... where owner_id = (select auth.uid())`. Legacy `owner_id = NULL` lists do NOT appear in the home (see D-09).

### Rename (LIST-02)
- **D-06:** Rename is an optimistic `listsStore` update + `UPDATE lists set name` — reflected immediately everywhere the name renders in the owner's session (lists-home, `ListPage` header, and Phase 8 sidebar). No realtime channel on the `lists` table in Phase 7: there is no partner/shared access until Phase 10, so cross-user/cross-device live name sync is deferred to when sharing exists. Single-session optimistic update satisfies "reflected everywhere it appears."

### Delete (LIST-03)
- **D-07:** Delete = `supabase.from('lists').delete().eq('id', listId)`. The existing `items.list_id ... references lists(id) ON DELETE CASCADE` (from Phase 1) auto-removes the list's items at the DB level — no separate item-delete, and cascade bypasses RLS so all items go regardless of `user_id`. The `lists_delete` RLS policy (`owner_id IS NULL OR auth.uid() = owner_id`) authorizes the owner. No new migration required for cascade.
- **D-08:** Confirmation dialog is mandatory (success criterion 3) — reuse the existing `Dialog` pattern (same as clear-checked in `ListPage`), destructive button styling, copy along the lines of "Delete '{name}'? This removes the list and all its items." Cancel leaves the list intact. If the user deletes the list they are **currently viewing** (`/list/:code`), navigate to the lists-home (`/`) after success; if deleting from the lists-home, stay there and the row disappears. This makes deleted lists unreachable at their URL (success criterion 4 — `ListPage`'s existing "List not found" handles a stale/deleted `share_code`).

### Entry flow & legacy lists
- **D-09:** Retire the **"Join a list"** form (`JoinListForm`) from the authenticated landing. In the auth era, access to someone else's list comes via invite links (Phase 10), not by typing a raw share code; the lists-home (create + your lists) replaces the v1.0 Create+Join dual-form landing. Direct navigation to `/list/:code` still works for anyone holding a code, so no access is lost before Phase 10. (Aligns with PROJECT.md: "Auth required — replaces anonymous link-share model.")
- **D-10:** Legacy `owner_id = NULL` lists (v1.0 data) are left **accessible-by-direct-URL but unmanaged** — not auto-claimed, not shown in the lists-home. Auto-claiming is ambiguous (either household member could claim a shared v1.0 list) and risky, so it is deferred (see Deferred Ideas). New lists created in v2.0 always have an owner.

### Claude's Discretion
- Empty-state copy/visual on the lists-home when the user owns zero lists (show a create prompt) — planner/UI decides.
- Whether `lists.owner_id` also gets a DB `DEFAULT auth.uid()` (D-04 defense-in-depth) or app-only assignment — planner decides.
- Exact placement/affordance of per-list rename + delete controls on the plain lists-home (inline buttons vs. small menu) — keep minimal; Phase 8 sidebar owns the polished version.
- List name constraints: trim whitespace, require non-empty (reuse `CreateListForm` validation). Duplicate names across a user's lists are allowed (no uniqueness constraint) unless the planner finds a reason otherwise.
- Whether `ListPage` reads list metadata from `listsStore` cache or keeps its independent `share_code` fetch (D-03) — planner decides, but the `share_code` fetch path must survive for legacy + direct nav.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, $0-budget / 2-user constraints, "Auth required — replaces anonymous link-share model" (drives D-09)
- `.planning/REQUIREMENTS.md` — LIST-01/02/03 (this phase); Out of Scope (no list folders, no >2 members, no granular permissions)
- `.planning/ROADMAP.md` §Phase 7 — Goal ("Users own named lists and can create, rename, and delete them") + 4 success criteria; §Phase 8 (sidebar = next phase, scope boundary for D-02)
- `.planning/STATE.md` §Accumulated Context — "Lists before Sidebar" ordering; RLS rules (`(select auth.uid())`, enable RLS + policies same migration, INSERT/UPDATE need USING + WITH CHECK)

### Prior Phase (Phase 6 — auth scaffolding this builds on)
- `.planning/phases/06-auth-foundation/06-CONTEXT.md` §D-11 — `lists` table scaffolding (`id, name, share_code, owner_id, created_at`); §D-07 — `authStore` pattern to mirror for `listsStore`
- `.planning/v2.0-MILESTONE-AUDIT.md` §Tech Debt — `owner_id` default asymmetry carried forward to Phase 7 (drives D-04)
- `supabase/migrations/lists_auth.sql` — current `lists` RLS policies (`owner_id IS NULL OR (select auth.uid()) = owner_id`) — delete authz (D-07) relies on these
- `supabase/migrations/items_auth.sql` — `items` RLS + `items.user_id DEFAULT auth.uid()` (the asymmetry reference for D-04)

### Base Schema (v1.0 — FK + cascade this phase relies on)
- `.planning/milestones/v1.0-phases/01-foundation/01-01-SUMMARY.md` §schema — `lists` / `items` DDL; `items.list_id ... references lists(id) ON DELETE CASCADE` (the cascade D-07 depends on)

### Technology
- `CLAUDE.md` §Technology Stack — React 19, Vite 8, Supabase (@supabase/supabase-js 2.106.1), Zustand, Tailwind v4, nanoid, React Router v6 data API

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/itemsStore.ts` / `src/stores/authStore.ts` — Zustand pattern to clone for the new `listsStore` (D-03): `create()` with actions calling the Supabase client, optimistic update + rollback.
- `src/components/CreateListForm.tsx` — already inserts into `lists` and navigates to `/list/:shareCode`. Must be updated to set `owner_id` (D-04); its name validation is reusable for rename.
- `src/components/ui/dialog.tsx` + `src/components/DeleteConfirmation.tsx` — reuse for the delete-confirmation dialog (D-08); `ListPage`'s clear-checked dialog is a working example of the `disablePointerDismissal` destructive pattern.
- `src/pages/LandingPage.tsx` — the authenticated branch becomes the lists-home (D-02); currently renders `CreateListForm` + `JoinListForm` (the latter retired per D-09).
- `src/pages/ListPage.tsx` — fetches a list by `share_code` (lines 60-82), renders `list.name` in the header; "List not found" path covers deleted lists (D-08, criterion 4).
- `src/router.tsx` — `createBrowserRouter`; `/list/:code` already wrapped by `ProtectedRoute`. Routes stay code-based (D-01).

### Established Patterns
- Stores own server data + mutation logic with optimistic updates + per-item rollback; pages own ephemeral UI state.
- Single Supabase client in `src/lib/supabase.ts`.
- RLS: `(select auth.uid())` (not bare), enable RLS + policies in the same migration, INSERT/UPDATE need both USING and WITH CHECK.
- Tailwind v4 mobile-first; `max-w-sm` / `max-w-md` centered columns.

### Integration Points
- `src/pages/LandingPage.tsx` — authed branch → lists-home consuming `listsStore.fetchLists` (D-02, D-05); remove `JoinListForm` (D-09).
- `src/components/CreateListForm.tsx` — add `owner_id: auth.uid()` to the insert (D-04).
- New `src/stores/listsStore.ts` — `fetchLists` / `createList` / `renameList` / `deleteList`.
- `src/pages/ListPage.tsx` — add owner-only rename/delete affordance (or surface on lists-home); on delete-of-current-list, navigate to `/` (D-08).
- DB — owner-scoped list reads (D-05); existing cascade + `lists` RLS cover delete (D-07); optional `owner_id` DEFAULT (D-04 discretion).

</code_context>

<specifics>
## Specific Ideas

- The lists-home is intentionally plain in Phase 7 — it exists to make CRUD demonstrable and to give the Phase 8 sidebar a data source. Don't over-invest in its visuals; the drawer is the real navigation surface and lands next phase.
- Deleting a list is a real data-loss action (cascade removes all its items) — the confirmation copy should make "and all its items" explicit, not just "delete this list".
- Phase 10 sharing will reintroduce cross-user access; the deliberate "owner-only, no realtime on lists" simplifications here (D-05, D-06) are scoped to pre-sharing reality and expected to be revisited then.

</specifics>

<deferred>
## Deferred Ideas

- **Claim legacy anonymous lists** — a one-time flow to let a signed-in user adopt v1.0 `owner_id = NULL` lists into their owned collection. Deferred from D-10 (ambiguous ownership in a 2-person household; risky). Candidate for a later phase or a manual one-off if Mitch/wife need their old lists in the home view.
- **Realtime list-name / list-collection sync across users** — live propagation of rename/create/delete to a partner's view. Belongs with Phase 10 (List Sharing), when cross-user list membership first exists.

</deferred>

---

*Phase: 7-Lists Infrastructure*
*Context gathered: 2026-05-28*
