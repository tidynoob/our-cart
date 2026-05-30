---
phase: 10-list-sharing
plan: "04"
subsystem: frontend/store
tags: [share-banner, invite-url, lists-store, rls, d-05, d-08]
dependency_graph:
  requires: [10-02, 10-03]
  provides: [invite-url-construction, membership-aware-list-fetch]
  affects: [src/components/ShareBanner.tsx, src/stores/listsStore.ts]
tech_stack:
  added: []
  patterns: [rls-reliance-over-app-filter, invite-url-routing]
key_files:
  created: []
  modified:
    - src/components/ShareBanner.tsx
    - src/stores/listsStore.ts
    - src/stores/listsStore.test.ts
decisions:
  - "D-05: ShareBanner constructs /invite/:code URLs — partner receives invite redemption flow, not blocked ListPage"
  - "D-08: fetchLists drops owner_id filter; RLS membership policy gates rows; _userId param kept for caller API compatibility"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-30"
  tasks: 2
  files: 3
---

# Phase 10 Plan 04: ShareBanner URL + fetchLists RLS Summary

**One-liner:** Repointed ShareBanner share URL to /invite/ (D-05) and removed owner_id filter from fetchLists so RLS-gated member lists appear in partner's sidebar (D-08).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Repoint ShareBanner URL to /invite/ (D-05) | e69b02d | src/components/ShareBanner.tsx |
| 2 | Remove owner_id filter from listsStore.fetchLists (D-08) | 53920f3 | src/stores/listsStore.ts, src/stores/listsStore.test.ts |

## Verification

- `grep "shareUrl" src/components/ShareBanner.tsx` shows `/invite/` — confirmed
- `grep "eq('owner_id'" src/stores/listsStore.ts` — no matches — confirmed
- `npx vitest run src/components/ShareBanner` — 5/5 tests pass GREEN (Wave 0 /invite/ assertion now GREEN)
- `npx vitest run src/` — 22 test files, 166 tests, all pass GREEN
- `npx tsc --noEmit` — exits 0, no errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated listsStore.test.ts to match new D-08 behavior**
- **Found during:** Task 2 verification
- **Issue:** `listsStore.test.ts` line 50 asserted `.eq('owner_id', 'u1')` was called — the exact behavior being removed. Test would fail after the D-08 change.
- **Fix:** Updated test name and assertion: changed `expect(mockEq).toHaveBeenCalledWith('owner_id', 'u1')` to `expect(mockEq).not.toHaveBeenCalledWith('owner_id', 'u1')`. Test now validates the new RLS-reliance behavior.
- **Files modified:** src/stores/listsStore.test.ts
- **Commit:** 53920f3

## Known Stubs

None — both changes are complete wiring. ShareBanner generates real invite URLs; fetchLists returns real RLS-scoped rows.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. ShareBanner URL change is client-side only (T-10-04-02: accepted). fetchLists filter removal relies on existing RLS from 10-01/10-02 migrations (T-10-04-01: mitigated by RLS).

## Self-Check: PASSED

- src/components/ShareBanner.tsx — contains `/invite/`: confirmed
- src/stores/listsStore.ts — no `.eq('owner_id'` filter: confirmed
- commit e69b02d — exists in git log: confirmed
- commit 53920f3 — exists in git log: confirmed
