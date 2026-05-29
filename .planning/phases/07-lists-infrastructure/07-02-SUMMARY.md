---
phase: "07"
plan: "02"
subsystem: lists-home-ui
tags: [react, zustand, supabase, dialog, lucide-react, testing-library]
dependency_graph:
  requires: ["07-01"]
  provides: ["LandingPage lists-home", "CreateListForm-migrated"]
  affects: ["07-03"]
tech_stack:
  added: ["@testing-library/jest-dom (devDependency — jest-dom matchers for vitest)"]
  patterns: ["single useListsStore() call for mock-compatible selector", "optimistic delete via store", "disablePointerDismissal dialog"]
key_files:
  created:
    - src/test-setup.ts
  modified:
    - src/components/CreateListForm.tsx
    - src/pages/LandingPage.tsx
    - vitest.config.ts
    - package.json
decisions:
  - "useListsStore() called without selector to destructure full state — required for vi.fn().mockReturnValue compatibility in LandingPage tests"
  - "renameError tracked as boolean (not string) — empty-name is the only validation case; simplifies state"
  - "handleRename/handleDeleteConfirm defined inline in component body (not outside return) — avoids stale closure issues with editingId/deleteTarget"
metrics:
  duration_seconds: 120
  completed_date: "2026-05-29"
  task_count: 2
  file_count: 5
---

# Phase 7 Plan 02: Lists-Home UI and CreateListForm Migration Summary

**One-liner:** LandingPage transformed into lists-home with owner-scoped list rows (inline rename + disablePointerDismissal delete dialog); CreateListForm now delegates entirely to listsStore.createList, closing the owner_id=NULL tech debt (D-04).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate CreateListForm to use listsStore.createList | 8c7a831 | src/components/CreateListForm.tsx |
| 2 | Transform LandingPage authenticated branch into lists-home | a3afdc3 | src/pages/LandingPage.tsx, src/test-setup.ts, vitest.config.ts, package.json, package-lock.json |

## Verification

- `npx vitest run src/pages/LandingPage.test.tsx` — 5/5 tests GREEN (3 AUTH-01 + 2 LIST-03)
- `npx vitest run src/stores/listsStore.test.ts` — 7/7 tests still GREEN
- `npx tsc --noEmit` — clean, no errors
- CreateListForm contains no `supabase.from('lists').insert` call
- LandingPage contains "This removes the list and all its items permanently." and "No lists yet"
- Delete dialog uses `disablePointerDismissal` + `showCloseButton={false}` + `variant="destructive"`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @testing-library/jest-dom test infrastructure**
- **Found during:** Task 2 — LandingPage tests use `.toBeInTheDocument()` (jest-dom matcher) but package was not installed and vitest had empty `setupFiles`
- **Issue:** All LIST-03 tests failed with "Invalid Chai property: toBeInTheDocument"
- **Fix:** Installed `@testing-library/jest-dom` as devDependency; created `src/test-setup.ts` importing it; added to `vitest.config.ts` setupFiles
- **Files modified:** package.json, package-lock.json, vitest.config.ts, src/test-setup.ts
- **Commit:** a3afdc3 (included in Task 2 commit)
- **Verification:** ListPage/NamePromptDialog failures confirmed pre-existing (existed before any changes in this plan — verified by git stash roundtrip)

**2. [Rule 1 - Design] useListsStore called without selector**
- **Found during:** Task 2 analysis — LandingPage.test.tsx mocks `useListsStore` as `vi.fn()` then uses `mockReturnValue(wholeState)`. With individual selectors, each `useListsStore(selector)` call returns the whole mock state object rather than the selected field. Using `useListsStore()` without a selector makes both the mock and production call return the full state, which is then destructured correctly.
- **Fix:** Called `useListsStore()` once and destructured with null-safe fallbacks (`?? []`, `?? false`, `?? null`)
- **Files modified:** src/pages/LandingPage.tsx

## Out-of-Scope Pre-existing Failures

The following test files had failures before this plan executed (confirmed by git stash verification):
- `src/pages/ListPage.test.tsx` — localStorage.getItem undefined (10 failures)
- `src/components/NamePromptDialog.test.tsx` — sessionStorage.setItem undefined (2 failures)

These are tracked for deferred resolution and are not regressions from this plan.

## Known Stubs

None — all data flows are wired through listsStore. The lists-home renders real store data; CreateListForm navigates to real share codes from DB.

## Threat Flags

None — no new network surface beyond the plan's threat model. Mitigations applied:
- T-07-06: editingName.trim() guard before renameList call; empty input shows inline error
- T-07-07: lists populated via fetchLists(user.id) with .eq('owner_id', userId) — owner-scoped
- T-07-08: disablePointerDismissal prevents accidental backdrop tap on mobile
- T-07-09: CreateListForm passes user.id from authStore (Supabase session) to createList; no form input can inject owner_id

## Self-Check: PASSED

- [x] src/components/CreateListForm.tsx exists and contains no supabase.from('lists').insert
- [x] src/pages/LandingPage.tsx exists and contains fetchLists, "No lists yet", "This removes the list and all its items permanently."
- [x] src/test-setup.ts exists
- [x] vitest.config.ts has setupFiles: ['./src/test-setup.ts']
- [x] Commit 8c7a831 (CreateListForm) confirmed in git log
- [x] Commit a3afdc3 (LandingPage + test infra) confirmed in git log
- [x] 5/5 LandingPage tests GREEN
- [x] 7/7 listsStore tests still GREEN
- [x] tsc --noEmit clean
