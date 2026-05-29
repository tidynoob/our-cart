---
phase: "09-auth-integration-into-listpage"
plan: "00"
subsystem: "test-scaffolds"
tags: ["tdd", "wave-0", "uiStore", "AttributionBadge", "test-scaffolds"]
dependency_graph:
  requires: []
  provides:
    - "src/stores/uiStore.test.ts"
    - "src/components/AttributionBadge.test.tsx"
  affects:
    - "src/stores/uiStore.ts"
    - "src/components/AttributionBadge.tsx"
tech_stack:
  added: []
  patterns:
    - "Zustand setState reset in beforeEach for isolated store tests"
    - "RED scaffold tests — asserting on not-yet-implemented behavior"
key_files:
  created:
    - "src/stores/uiStore.test.ts"
    - "src/components/AttributionBadge.test.tsx"
  modified: []
decisions:
  - "uiStore.test.ts requires no supabase mock — store has no async calls, simplifying test setup"
  - "AttributionBadge.test.tsx uses container.querySelector('img') instead of role query — img rendered conditionally by future avatarUrl prop"
metrics:
  duration: "62s"
  completed_date: "2026-05-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 9 Plan 00: Wave 0 Test Scaffolds Summary

Wave 0 test scaffold creation for uiStore.restoreBanner (NAV-03) and AttributionBadge avatarUrl (PROF-02). Two new test files exist with correct RED/GREEN split — existing behavior passes, not-yet-implemented behavior fails with type/property errors (not syntax errors).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create uiStore.test.ts scaffold | 329a04b | src/stores/uiStore.test.ts |
| 2 | Create AttributionBadge.test.tsx scaffold | 325f26d | src/components/AttributionBadge.test.tsx |

## Verification Results

Both files run cleanly. 5 tests GREEN, 5 tests RED (as mandated by Wave 0 spec):

**uiStore.test.ts (5 tests):**
- GREEN: `dismissBanner adds code to Set`
- GREEN: `dismissBanner creates new Set reference`
- RED: `restoreBanner removes code from dismissedBanners` — "restoreBanner is not a function"
- RED: `restoreBanner returns new Set reference` — "restoreBanner is not a function"
- RED: `restoreBanner does not throw for missing code` — "restoreBanner is not a function"

**AttributionBadge.test.tsx (5 tests):**
- GREEN: `renders initials when no avatarUrl (PROF-02 fallback)`
- GREEN: `wrapper has aria-label "{name} added this"`
- GREEN: `does NOT render img when avatarUrl is undefined`
- RED: `renders img with referrerPolicy="no-referrer" when avatarUrl present` — img is null (prop not implemented)
- RED: `falls back to initials when img fires onError` — img is null (prop not implemented)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

These are intentional Wave 0 stubs — the failing tests ARE the stubs. They will be resolved in:
- Wave 1 (Plan 09-01): adds `restoreBanner` to uiStore.ts
- Wave 2 (Plan 09-02): adds `avatarUrl` prop to AttributionBadge.tsx

## Threat Flags

No new security surface introduced — test files only, no network endpoints or auth paths added.

## Self-Check: PASSED

- [x] src/stores/uiStore.test.ts exists at expected path
- [x] src/components/AttributionBadge.test.tsx exists at expected path
- [x] Commit 329a04b verified in git log
- [x] Commit 325f26d verified in git log
- [x] 5 GREEN / 5 RED vitest results confirmed
