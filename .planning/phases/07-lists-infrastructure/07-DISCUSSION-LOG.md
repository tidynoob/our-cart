# Phase 7: Lists Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 7-Lists Infrastructure
**Areas discussed:** UI scope vs Phase 8, List URL identity, Delete semantics, Entry flow & legacy

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| UI scope vs Phase 8 | Ship CRUD UI now vs data-layer-only, controls in Phase 8 | (delegated) |
| List URL identity | Keep share_code in /list/:code vs switch to list id | (delegated) |
| Delete semantics | Cascade items, redirect-on-current, confirmation dialog | (delegated) |
| Entry flow & legacy | Post-auth landing, fate of Join form, legacy NULL lists | (delegated) |

**User's choice:** "go with your recommendations" — all four areas delegated to Claude.
**Notes:** User opted not to discuss individually and authorized recommended defaults. Decisions below were locked by Claude from codebase analysis (lists table schema, RLS policies, FK cascade, Phase 6 tech debt) and presented for veto rather than per-question selection.

---

## UI scope vs Phase 8

**Recommendation applied:** Phase 7 ships a minimal plain lists-home page (create + per-list rename/delete) plus a new `listsStore`. The slide-in sidebar drawer + active highlighting stay in Phase 8, layered on the same store. (CONTEXT D-02, D-03)
**Rationale:** Success criteria 1-4 require demonstrable CRUD; a plain index is a clean, non-throwaway split with Phase 8 (drawer = presentation of the same data).

## List URL identity

**Recommendation applied:** Keep `share_code` in `/list/:code`; do not switch to list `id`. (CONTEXT D-01)
**Rationale:** Zero rewrite of ListPage/CreateListForm/itemsStore; keeps Phase 10 sharing trivial (share URL = list URL).

## Delete semantics

**Recommendation applied:** `delete().eq('id', listId)` relying on existing `ON DELETE CASCADE` for items; mandatory confirmation dialog (reuse `Dialog`); redirect to `/` when deleting the currently-viewed list. (CONTEXT D-07, D-08)
**Rationale:** Cascade already exists in v1.0 schema and bypasses RLS; `lists_delete` RLS authorizes the owner. No new migration for cascade.

## Entry flow & legacy

**Recommendation applied:** Lists-home replaces the Create+Join landing; retire `JoinListForm` (access to others' lists comes via Phase 10 invites; direct `/list/:code` nav still works). Legacy `owner_id = NULL` lists left URL-accessible but unmanaged, not auto-claimed, not shown in home. Set `owner_id = auth.uid()` on create to fix Phase 6 tech debt. (CONTEXT D-04, D-05, D-09, D-10)
**Rationale:** Aligns with PROJECT.md "auth replaces anonymous link-share"; auto-claiming legacy lists is ambiguous in a 2-person household.

---

## Claude's Discretion

- Empty-state copy/visual when user owns zero lists.
- Whether `lists.owner_id` gets a DB `DEFAULT auth.uid()` (defense-in-depth) or app-only assignment.
- Placement of per-list rename/delete controls on the plain lists-home (inline vs menu).
- List name constraints (trim + non-empty reused; duplicates allowed).
- Whether `ListPage` reads metadata from `listsStore` cache or keeps its independent `share_code` fetch (the fetch path must survive regardless).

## Deferred Ideas

- Claim legacy anonymous (`owner_id = NULL`) lists into a user's owned collection — deferred from D-10.
- Realtime list-name / list-collection sync across users — belongs with Phase 10 (List Sharing).
