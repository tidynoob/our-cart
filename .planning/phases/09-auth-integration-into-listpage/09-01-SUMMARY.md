---
phase: 09-auth-integration-into-listpage
plan: "01"
subsystem: stores/types
tags: [authStore, uiStore, types, tdd, optimistic-update]
dependency_graph:
  requires: ["09-00"]
  provides: ["09-02", "09-03", "09-04"]
  affects: ["src/types/item.ts", "src/stores/authStore.ts", "src/stores/uiStore.ts"]
tech_stack:
  added: []
  patterns: ["optimistic-update-rollback", "zustand-new-set-reference", "tdd-red-green"]
key_files:
  created: []
  modified:
    - src/types/item.ts
    - src/stores/authStore.ts
    - src/stores/uiStore.ts
    - src/stores/authStore.test.ts
decisions:
  - "updateDisplayName uses getUser() for rollback (not snapshot) — auth user is a singleton, no prev snapshot needed"
  - "onAuthStateChange callback left unchanged — USER_UPDATED double-write is idempotent by design"
  - "Only display_name key written in updateUser data object — server-controlled keys preserved by Supabase shallow merge (T-09-01-02)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-29"
  tasks_completed: 2
  files_modified: 4
---

# Phase 9 Plan 01: Foundational Contracts — Item.user_id, authStore.updateDisplayName, uiStore.restoreBanner Summary

**One-liner:** Wired three store/type contracts — `user_id` on Item, optimistic `updateDisplayName` with rollback, and `restoreBanner` inverse action — enabling all downstream Wave 2-4 plans.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Item type and add uiStore.restoreBanner | 7f9cfca | src/types/item.ts, src/stores/uiStore.ts |
| 2 (RED) | Add authStore.updateDisplayName tests | 88c6618 | src/stores/authStore.test.ts |
| 2 (GREEN) | Implement authStore.updateDisplayName | 310c766 | src/stores/authStore.ts |

## What Was Built

### Item type (D-05)
Added `user_id: string | null` after `added_by` in the Item interface. The DB column already exists (`items_auth.sql: uuid DEFAULT auth.uid()`), `select('*')` already returns it — only the TypeScript type was missing.

### uiStore.restoreBanner (D-11)
Added inverse of `dismissBanner`. Creates a new Set reference (required for Zustand reactivity) then deletes the code. Three tests added in Wave 0 now flip GREEN.

### authStore.updateDisplayName (PROF-01, D-03)
Optimistic update pattern mirroring `listsStore.renameList`:
1. Trim + non-empty guard (returns early on empty/whitespace — T-09-01-01 mitigated)
2. Optimistic `set()` updating `user_metadata.display_name` before server call
3. `supabase.auth.updateUser({ data: { display_name: trimmed } })` — only `display_name` key written (T-09-01-02)
4. On error: `getUser()` rollback + `set({ user, error: error.message })`

Critical constraint maintained: `onAuthStateChange` callback unchanged. USER_UPDATED event fires idempotently after successful `updateUser` — no infinite loop.

## Test Results

```
authStore.test.ts — 14 tests passed (9 pre-existing + 5 new updateDisplayName)
uiStore.test.ts  —  5 tests passed (2 pre-existing + 3 restoreBanner now GREEN)
Total: 19 tests GREEN
```

## TDD Gate Compliance

- RED gate: commit `88c6618` — `test(09-01)` with 5 failing updateDisplayName tests
- GREEN gate: commit `310c766` — `feat(09-01)` with all 14 authStore tests passing
- REFACTOR: not required (implementation was clean first pass)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. `updateDisplayName` calls `supabase.auth.updateUser` — this is an existing Supabase auth surface, already in the threat model (T-09-01-01, T-09-01-02, T-09-01-SC all addressed).

## Known Stubs

None. All implementations are fully wired — no placeholder values or TODO markers.

## Self-Check: PASSED

- src/types/item.ts — FOUND (user_id field present)
- src/stores/uiStore.ts — FOUND (restoreBanner action present)
- src/stores/authStore.ts — FOUND (updateDisplayName action present)
- src/stores/authStore.test.ts — FOUND (5 new tests present)
- Commit 7f9cfca — FOUND
- Commit 88c6618 — FOUND
- Commit 310c766 — FOUND
