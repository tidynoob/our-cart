---
phase: 10-list-sharing
plan: "00"
subsystem: test-infrastructure
tags: [tdd, red-state, wave-0, invite, share]
dependency_graph:
  requires: []
  provides: [SHARE-02-red-gate, D-05-red-gate]
  affects: [src/pages/InvitePage.test.tsx, src/components/ShareBanner.test.tsx]
tech_stack:
  added: []
  patterns: [it.todo stub pattern, vi.mock supabase rpc]
key_files:
  created:
    - src/pages/InvitePage.test.tsx
  modified:
    - src/components/ShareBanner.test.tsx
decisions:
  - it.todo stubs chosen over dynamic import — Wave 0 goal is 0-compile-error RED state, not partially-working tests
  - /invite/ assertion placed inside existing waitFor block to keep test cohesion
metrics:
  duration_minutes: 5
  completed_date: "2026-05-30"
  tasks: 2
  files_changed: 2
---

# Phase 10 Plan 00: Wave 0 RED Test Stubs Summary

Wave 0 test stubs for Phase 10 list-sharing: 5 it.todo stubs for InvitePage (SHARE-02 Nyquist gate) and one RED failing assertion in ShareBanner (D-05 /invite/ URL contract).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create InvitePage.test.tsx with failing stubs | 9bc5447 | src/pages/InvitePage.test.tsx (created) |
| 2 | Add /invite/ URL assertion to ShareBanner.test.tsx | 82adae4 | src/components/ShareBanner.test.tsx (modified) |

## Verification Results

1. `npx vitest run src/pages/InvitePage` — exits 0, 5 todo stubs under `InvitePage` describe
2. `npx vitest run src/components/ShareBanner` — 1 failing test (Copy link /invite/ RED), 4 passing
3. `npx tsc --noEmit` — no TypeScript errors

## Decisions Made

- **it.todo stub pattern**: InvitePage.tsx does not exist yet — used `it.todo` stubs instead of dynamic imports or compile-guarded imports. All 5 stubs compile clean and exit 0. Wave 3 (10-03-PLAN.md) will expand these into real tests when the component exists.
- **/invite/ assertion placement**: New `expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/invite/ABC12345'))` added inside the existing `waitFor` callback, keeping assertion locality with the copy-link action. Fails RED immediately because ShareBanner.tsx still uses `/list/` (D-05 not yet implemented).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `src/pages/InvitePage.test.tsx` — all 5 tests are `it.todo` by design (Wave 0 intent). Stubs will be wired in Wave 3 (10-03-PLAN.md) when InvitePage.tsx is created.

## Self-Check: PASSED

- [x] src/pages/InvitePage.test.tsx exists
- [x] src/components/ShareBanner.test.tsx contains '/invite/ABC12345'
- [x] Commit 9bc5447 exists (InvitePage stubs)
- [x] Commit 82adae4 exists (ShareBanner /invite/ assertion)
- [x] npx tsc --noEmit clean
