---
phase: 07-lists-infrastructure
plan: "00"
subsystem: testing
tags: [vitest, testing-library, zustand, supabase, listsStore]

# Dependency graph
requires: []
provides:
  - "7 failing unit test stubs for listsStore covering LIST-01/02/03 (create+rollback, fetch owner-scoped, rename+rollback, delete+rollback)"
  - "2 failing LIST-03 dialog tests in LandingPage.test.tsx (delete dialog copy, cancel without calling deleteList)"
  - "Chainable Supabase builder mock pattern (vi.hoisted + mockFrom/Select/Insert/Update/Delete/Eq/Order/Single)"
affects:
  - 07-01-listsStore-implementation
  - 07-02-LandingPage-lists-home

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chainable Supabase builder mock via vi.hoisted — mockFrom returns object with all builder methods as vi.fn().mockReturnThis(); terminal calls (mockSingle, mockOrder) receive mockResolvedValueOnce"
    - "useListsStore.setState({ lists: [], loading: false, error: null }) in beforeEach for isolation"
    - "vi.mock('@/stores/listsStore') pattern for mocking store in component tests"

key-files:
  created:
    - src/stores/listsStore.test.ts
  modified:
    - src/pages/LandingPage.test.tsx

key-decisions:
  - "mockOrder is terminal for fetchLists chain (.from.select.eq.order); mockSingle is terminal for createList (.from.insert.select.single); mockEq is terminal for renameList and deleteList"
  - "LandingPage tests import @testing-library/user-event for realistic click simulation on dialog interactions"
  - "All new tests intentionally RED — listsStore.ts does not exist yet; Wave 0 stubs establish test contract for Plan 01"

patterns-established:
  - "Wave 0 test scaffold pattern: write failing stubs before implementation, mirror authStore.test.ts vi.hoisted structure"
  - "Chainable builder mock: each method returns the same mock object via .mockReturnThis() except terminal calls"

requirements-completed:
  - LIST-01
  - LIST-02
  - LIST-03

# Metrics
duration: 2min
completed: 2026-05-29
---

# Phase 7 Plan 00: Wave 0 Test Scaffolds Summary

**Vitest RED stubs for listsStore (7 behaviors) and LandingPage delete dialog (2 behaviors) using vi.hoisted chainable Supabase builder mock pattern**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-29T03:07:42Z
- **Completed:** 2026-05-29T03:09:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/stores/listsStore.test.ts` with 7 failing unit stubs covering all LIST-01/02/03 behaviors (fetch, create+rollback, rename+rollback, delete+rollback)
- Extended `src/pages/LandingPage.test.tsx` with 2 failing LIST-03 dialog tests (dialog renders "all its items" copy; cancel leaves list intact without calling deleteList)
- Established chainable Supabase builder mock pattern via `vi.hoisted` that will be the verification harness for Plan 01 implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create listsStore.test.ts with 7 failing stubs** - `a7f3136` (test)
2. **Task 2: Update LandingPage.test.tsx with LIST-03 dialog tests** - `ecfac99` (test)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/stores/listsStore.test.ts` — 7 unit stubs for listsStore CRUD actions with vi.hoisted chainable Supabase builder mock; RED because listsStore.ts not yet created
- `src/pages/LandingPage.test.tsx` — 2 new LIST-03 dialog tests appended; vi.mock('@/stores/listsStore') added; existing 3 tests untouched; RED because listsStore.ts not yet created

## Decisions Made
- **Terminal call assignment:** `mockOrder` is terminal for `fetchLists` (chain ends at `.order()`), `mockSingle` for `createList` (chain ends at `.single()`), `mockEq` for `renameList` and `deleteList` (chain ends at `.eq()`). This matches 07-PATTERNS.md chain documentation.
- **userEvent over fireEvent:** Used `@testing-library/user-event` for dialog interaction tests — more realistic simulation of click events that trigger pointer/mouse events the Dialog component may depend on.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — both test files fail with the expected `Cannot find module` import errors, confirming correct RED Wave 0 state.

## Known Stubs

All test stubs in `src/stores/listsStore.test.ts` and the two new tests in `src/pages/LandingPage.test.tsx` are intentionally RED. This is by design — Wave 0 establishes the test contract; Plan 01 implements `listsStore.ts` to make them green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wave 0 scaffolds complete; all test stubs in place
- Plan 01 can now implement `src/stores/listsStore.ts` and `src/types/list.ts` — tests will turn green as implementation is added
- LandingPage.test.tsx will require LandingPage.tsx to consume `useListsStore` (Plan 02) before dialog tests pass

---
*Phase: 07-lists-infrastructure*
*Completed: 2026-05-29*
