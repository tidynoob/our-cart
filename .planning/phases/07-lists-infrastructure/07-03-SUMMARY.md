---
phase: "07"
plan: "03"
subsystem: list-page-owner-controls
tags: [react, zustand, supabase, dialog, lucide-react, tailwind]
dependency_graph:
  requires: ["07-02"]
  provides: ["ListPage rename/delete affordances", "live-name-from-store D-06", "delete-navigates-home D-08"]
  affects: ["08-app-shell"]
tech_stack:
  added: []
  patterns: ["useListsStore selector for live name cache", "isOwner guard (user.id === list.owner_id)", "await-then-navigate (Pitfall 3)", "inline rename input (no modal)", "disablePointerDismissal delete dialog"]
key_files:
  created: []
  modified:
    - src/pages/ListPage.tsx
decisions:
  - "displayName = storedName ?? list?.name — store cache takes precedence for live rename, local state is fallback for direct URL nav (D-03 preserved)"
  - "isOwner derived inline (not stored in state) — avoids stale closure and simplifies re-render path"
  - "savedUserName (renamed from storedName in useEffect) — avoids variable shadowing with module-level storedName derived from listsStore cache"
metrics:
  duration_seconds: 300
  completed_date: "2026-05-29"
  task_count: 1
  file_count: 1
---

# Phase 7 Plan 03: ListPage Rename/Delete Affordances Summary

**One-liner:** ListPage wired to listsStore for live name display (D-06) with owner-only inline rename and disablePointerDismissal delete dialog that navigates to '/' on success (D-08); share_code fetch path preserved unchanged (D-03).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire listsStore into ListPage for live name, rename, and delete | a1dcb8a | src/pages/ListPage.tsx |

## Verification

- `npx tsc --noEmit` — clean, no errors
- `npx vitest run src/pages/ListPage.test.tsx` — 2/12 pass, 10 fail — identical to pre-existing baseline (all failures are localStorage/sessionStorage undefined issues pre-dating this phase)
- `npx vitest run` — full suite: no new failures introduced
- ListPage.tsx contains `owner_id: string` in local List interface
- ListPage.tsx select query contains `'id, name, share_code, owner_id, created_at'`
- ListPage.tsx contains `useListsStore` selector for `storedLists`
- ListPage.tsx contains `const displayName = storedName ?? list?.name`
- ListPage.tsx contains `disablePointerDismissal` on delete-list Dialog
- ListPage.tsx contains `"This removes the list and all its items permanently."`
- ListPage.tsx contains `navigate('/')` called after `await deleteList`
- ListPage.tsx does NOT contain a `fetchLists` call
- ListPage.tsx share_code fetch (`.eq('share_code', code)`) preserved unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Shadowing] Renamed `storedName` in useEffect to `savedUserName`**
- **Found during:** Task 1 — module-level `const storedName = storedLists.find(...)` shadowed the `const storedName = localStorage.getItem(...)` inside the useEffect callback
- **Fix:** Renamed the localStorage variable to `savedUserName` to eliminate the shadow and avoid TypeScript strictness warnings
- **Files modified:** src/pages/ListPage.tsx
- **Commit:** a1dcb8a (included in Task 1 commit)

## Out-of-Scope Pre-existing Failures

The following test failures existed before this plan and remain unchanged:
- `src/pages/ListPage.test.tsx` — 10 failures (clear-completed flow, reconnect/visibilitychange/online/offline syncStatus handlers, share_code case-normalization test) — all fail due to `localStorage` undefined in jsdom without setup
- `src/components/NamePromptDialog.test.tsx` — pre-existing localStorage/sessionStorage failures

No new failures were introduced by this plan.

## Known Stubs

None — displayName flows from store cache (when available) or local list state; isOwner gate is derived from live auth state; delete and rename call real store actions.

## Threat Flags

None — mitigations applied per threat register:
- T-07-10: `isOwner = Boolean(user && list && user.id === list.owner_id)` — affordances hidden from non-owners; RLS enforces at DB layer
- T-07-11: `await deleteList(list!.id)` before `navigate('/')` — navigation only after DB confirms (Pitfall 3)
- T-07-12: Legacy NULL owner_id lists get `isOwner=false` — no affordances shown; read-only access preserved (D-10)

## Self-Check: PASSED

- [x] src/pages/ListPage.tsx exists and contains `owner_id: string` in local interface
- [x] src/pages/ListPage.tsx select query contains `owner_id`
- [x] src/pages/ListPage.tsx contains `useListsStore` for live name
- [x] src/pages/ListPage.tsx contains `displayName = storedName ?? list?.name`
- [x] src/pages/ListPage.tsx contains `disablePointerDismissal` on delete dialog
- [x] src/pages/ListPage.tsx contains "This removes the list and all its items permanently."
- [x] src/pages/ListPage.tsx contains `navigate('/')` after `await deleteList`
- [x] src/pages/ListPage.tsx does NOT contain `fetchLists`
- [x] src/pages/ListPage.tsx `.eq('share_code', code)` fetch preserved
- [x] Commit a1dcb8a confirmed in git log
- [x] npx tsc --noEmit clean
- [x] No new test failures vs pre-existing baseline
