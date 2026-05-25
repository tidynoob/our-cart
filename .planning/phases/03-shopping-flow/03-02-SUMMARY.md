---
phase: 03-shopping-flow
plan: "02"
subsystem: shopping-flow
tags: [clearChecked, bulk-delete, optimistic-update, confirmation-dialog, tdd, store-action, integration-test]
dependency_graph:
  requires: [03-01]
  provides: [clearChecked-action, clear-completed-dialog, bulk-delete-rollback]
  affects: [itemsStore, ListPage]
tech_stack:
  added: []
  patterns:
    - Bulk optimistic delete with array snapshot before set() (Pitfall 4 prevention)
    - Chained .eq().eq() Supabase DELETE as AND conditions
    - Single set() for rollback with both items and error keys (CR-02)
    - act() wrapping for Base UI dialog portal mount reliability in jsdom tests
    - Zustand store state reset in beforeEach for test isolation
key_files:
  created: []
  modified:
    - src/stores/itemsStore.ts
    - src/stores/itemsStore.test.ts
    - src/pages/ListPage.tsx
    - src/pages/ListPage.test.tsx
decisions:
  - "Zustand store state reset in beforeEach required for clear-flow integration tests — without it, accumulated items state from previous tests prevents correct rendering"
  - "act() from @testing-library/react required to force Base UI FloatingPortal layout effects to flush synchronously after click — findByText alone insufficient"
  - "clearChecked snapshot (get().items.filter) taken before optimistic set() — critical invariant per PATTERNS.md Pitfall 4"
  - "Rollback uses single set() call combining items restore and error string — never two separate set() calls (PATTERNS.md invariant)"
metrics:
  duration: "15 minutes"
  completed: "2026-05-25"
  tasks: 2
  files: 4
---

# Phase 03 Plan 02: Clear Completed Action + Dialog Wiring Summary

## One-Liner

Bulk optimistic clearChecked store action with array snapshot rollback, wired to the existing ListPage dialog scaffold via handleClearConfirm, completing the SHOP-03/SHOP-04 clear-completed vertical slice.

## What Was Built

### Task 1: clearChecked store action + unit tests

**TDD cycle completed:**

- RED: 3 clearChecked tests added to `itemsStore.test.ts` — all 3 failed (clearChecked not in store), 3 toggleChecked tests still passed
- GREEN: `itemsStore.ts` extended with `clearChecked` — all 6 tests pass

**`src/stores/itemsStore.ts`** — Extended with `clearChecked`:
- Interface: `clearChecked: (listId: string) => Promise<void>` after toggleChecked
- Snapshot: `const checkedItems = get().items.filter((i) => i.checked)` BEFORE any `set()` call (Pitfall 4 enforcement)
- Early return guard: `if (checkedItems.length === 0) return` — no Supabase call when nothing to clear
- Optimistic bulk remove: `set((state) => ({ items: state.items.filter((i) => !i.checked) }))`
- Supabase DELETE: `.delete().eq('list_id', listId).eq('checked', true)` — chained AND conditions
- Rollback: single `set()` call with BOTH `items: [...state.items, ...checkedItems]` and `error: 'Failed to clear items'` (CR-02)

**`src/stores/itemsStore.test.ts`** — 3 new tests added:
1. Optimistic: `items=[unchecked-A]` immediately after calling `clearChecked` (checked B+C removed)
2. Rollback: all 3 items restored + `error === 'Failed to clear items'` when Supabase errors
3. No-op: `mockDeleteFn` not called when all items are unchecked (early return guard verified)

### Task 2: Wire clearChecked into ListPage + integration tests

**TDD cycle completed:**

- RED: 5 integration tests added to `ListPage.test.tsx` — 3 dialog-interaction tests failed (Clear Items button not wired), 2 conditional-render tests passed already
- GREEN: `ListPage.tsx` extended with `clearChecked` subscription and `handleClearConfirm` — all 5 tests pass

**`src/pages/ListPage.tsx`** — Completed from Plan 01 scaffold:
- `clearChecked` subscribed: `const clearChecked = useItemsStore((state) => state.clearChecked)`
- `handleClearConfirm()` added: `setClearDialogOpen(false)` then `clearChecked(list!.id).catch(() => {})`
- "Clear Items" button onClick changed from placeholder comment to `onClick={handleClearConfirm}`
- All other scaffold from Plan 01 (button, dialog, disablePointerDismissal) unchanged

**`src/pages/ListPage.test.tsx`** — 5 integration tests added:
1. No button when no checked items — button absent from DOM entirely (D-06)
2. Button visible shows "Clear completed (1)" — live count correct (D-06)
3. Dialog opens on button click — Keep Items and Clear Items buttons rendered (SHOP-04)
4. Keep Items closes dialog without delete — mockDelete NOT called (SHOP-04)
5. Clear Items triggers Supabase delete — mockDeleteEq1 called with list_id, mockDeleteEq2 with checked=true (SHOP-03)

## Test Results

```
Test Files: 9 passed
Tests:      52 passed (0 failed)
```

All 52 tests green including 8 new tests (itemsStore.test.ts × 3, ListPage.test.tsx × 5) and all 44 pre-existing tests.

## Deviations from Plan

### Test infrastructure: act() required for Base UI dialog portal in jsdom

**Rule 3 - Blocking Issue Fixed**
**Found during:** Task 2 RED phase — dialog tests timing out at 1000ms
**Issue:** `waitFor` and `findByText` with default 1000ms timeout were insufficient because Base UI's `FloatingPortal` uses `useIsoLayoutEffect` (mapped to `useLayoutEffect` in jsdom) to initialize the portal node with two sequential state updates. In test context with complex component trees (Zustand subscriptions, async effects), these layout effects don't flush synchronously within `waitFor`'s default timeout.
**Fix:** Wrap `userEvent.click` calls in `act(async () => { await userEvent.click(...) })` from `@testing-library/react`. This forces React to flush all pending state updates and layout effects before the test continues.
**Note:** "act() not configured" warnings appear on stderr but tests pass correctly — these are informational warnings about Zustand updates outside React's rendering cycle, not failures.
**Files modified:** `src/pages/ListPage.test.tsx`
**Commit:** 97e7f70

### Test isolation: Zustand store state reset required in beforeEach

**Rule 1 - Bug Fixed**
**Found during:** Task 2 RED phase — first dialog-open test failed without the reset; debug traced it to Zustand store accumulating item state from prior tests
**Issue:** Zustand store is a module singleton. Items from earlier tests (e.g., `[uncheckedItem]` from "no button" test) persisted into the dialog-interaction tests, potentially causing incorrect `checkedCount` or fetch race conditions.
**Fix:** Added `useItemsStore.setState({ items: [], loading: false, error: null })` in the clear-flow `beforeEach`.
**Files modified:** `src/pages/ListPage.test.tsx`
**Commit:** 97e7f70

### TDD gate: 2 of 5 RED tests passed in RED phase

**Expected deviation documented:** Tests for "no button when no checked" and "button visible" passed in the RED phase because the ListPage scaffold from Plan 01 already implemented those behaviors. Only the 3 dialog-interaction tests (involving `clearChecked` wiring) failed. This is correct TDD behavior — the failing tests precisely identified the missing implementation.

## Known Stubs

None — `clearChecked` is now fully wired. The Plan 01 stub comment `// clearChecked is Plan 02 — placeholder` has been replaced with `onClick={handleClearConfirm}`.

## Threat Flags

None. Changes are within the existing trust boundary:
- `clearChecked` sends DELETE scoped by `list_id` (server-side RLS validates UUID)
- `list.id` is read from the Supabase fetch result, never from user input
- Modal dialog as intent gate is fully functional (disablePointerDismissal verified in tests)

## TDD Gate Compliance

- RED gate: Tests written first and verified to fail (itemsStore.test.ts × 3, ListPage.test.tsx × 3 of 5)
- GREEN gate: Implementation written, all tests pass
- REFACTOR gate: No cleanup needed

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/stores/itemsStore.ts contains clearChecked (interface + impl) | FOUND |
| src/stores/itemsStore.test.ts has 3 clearChecked tests | FOUND |
| src/pages/ListPage.tsx contains clearChecked subscription | FOUND |
| src/pages/ListPage.tsx contains handleClearConfirm | FOUND |
| src/pages/ListPage.test.tsx has 5 clear-flow tests | FOUND |
| Commit 655a39e (Task 1: store action) exists | FOUND |
| Commit 97e7f70 (Task 2: ListPage wiring) exists | FOUND |
| All 52 tests pass (npx vitest run) | CONFIRMED |
| TypeScript compiles clean (npx tsc --noEmit) | CONFIRMED |
| Build passes (npm run build) | CONFIRMED |
