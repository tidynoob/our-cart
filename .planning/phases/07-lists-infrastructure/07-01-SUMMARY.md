---
phase: "07"
plan: "01"
subsystem: lists-store
tags: [zustand, supabase, optimistic-updates, types]
dependency_graph:
  requires: ["07-00"]
  provides: ["List type", "useListsStore"]
  affects: ["07-02", "07-03"]
tech_stack:
  added: []
  patterns: ["optimistic-update + rollback", "snapshot-before-set (Pitfall 4)"]
key_files:
  created:
    - src/types/list.ts
    - src/stores/listsStore.ts
  modified: []
decisions:
  - "owner_id typed as string (not string | null) — eq filter ensures NULL rows never enter store state"
  - "createList returns share_code string so callers can navigate to /list/:shareCode"
  - "No realtime channel on lists table per D-06 — store is fetch-on-demand only"
metrics:
  duration_seconds: 59
  completed_date: "2026-05-29"
  task_count: 2
  file_count: 2
---

# Phase 7 Plan 01: List Type and listsStore Summary

**One-liner:** Zustand listsStore with owner-scoped fetchLists, optimistic createList/renameList/deleteList with snapshot-before-set rollback — no realtime channel.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/types/list.ts | 145ba5c | src/types/list.ts |
| 2 | Create src/stores/listsStore.ts | f13bf53 | src/stores/listsStore.ts |

## Verification

- `npx vitest run src/stores/listsStore.test.ts` — 7/7 tests GREEN
- `npx tsc --noEmit` — clean, no errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stub patterns introduced.

## Threat Flags

None — no new network surface beyond what was planned. Threat mitigations applied:
- T-07-01: fetchLists uses `.eq('owner_id', userId)` — owner-scoped query
- T-07-02: createList sets `owner_id: userId` explicitly on insert
- T-07-03: update/delete use `.eq('id', id)` — RLS enforces cross-user block at DB layer
- T-07-04: `name.trim()` + non-empty guard in createList and renameList
- T-07-05: Generic error strings only — raw Supabase error.message never surfaced to state

## Self-Check: PASSED

- [x] src/types/list.ts exists
- [x] src/stores/listsStore.ts exists
- [x] Commit 145ba5c (list.ts) confirmed in git log
- [x] Commit f13bf53 (listsStore.ts) confirmed in git log
- [x] 7/7 unit tests pass
- [x] tsc --noEmit clean
