---
phase: 02-list-management
plan: 05
subsystem: ui
tags: [react, select, portal, blur, focus-scope, base-ui]

requires:
  - phase: 02-list-management
    provides: ItemRow inline edit with focus-scope blur pattern

provides:
  - Portal-aware blur guard in ItemRow category Select dropdown

affects: [02-list-management]

tech-stack:
  added: []
  patterns:
    - "selectOpenRef pattern: track Select open state via onOpenChange to guard portal-triggered blur exits"

key-files:
  created: []
  modified:
    - src/components/ItemRow.tsx

key-decisions:
  - "Use selectOpenRef.current guard in handleRowBlur rather than patching SelectContent — fix belongs in consumer blur logic, not the shared component"
  - "onOpenChange fires synchronously before focus transfer completes, so setting selectOpenRef.current=true before setTimeout(0) fires is safe"

patterns-established:
  - "Portal blur guard: when a Select (or any portal-rendered control) is nested inside a focus-scope div, track open state via onOpenChange and early-return the blur handler while open"

requirements-completed:
  - LIST-02

duration: ~5min
completed: 2026-05-25
---

# Phase 02 Plan 05: Category Select Portal Blur Fix Summary

**Portal-aware blur guard added to ItemRow so the category Select dropdown stays open during interaction without triggering premature save-and-exit**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-25T20:36:00Z
- **Completed:** 2026-05-25T20:41:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Root cause identified: `SelectContent` uses `SelectPrimitive.Portal`, rendering the dropdown outside `rowRef`'s DOM subtree. The existing `handleRowBlur` setTimeout(0) check correctly found `document.activeElement` outside `rowRef` and exited edit mode.
- Added `selectOpenRef = useRef(false)` to track whether the Select is open.
- Wired `onOpenChange={(open) => { selectOpenRef.current = open }}` on the `Select` component so the ref stays in sync.
- Added an early return in `handleRowBlur` when `selectOpenRef.current` is true, preventing premature save while the portal has focus.
- TypeScript compiles clean; no test regressions.

## Task Commits

1. **Task 1: Add selectOpenRef to ItemRow to prevent portal-triggered blur exits** - `c3c6f3a` (fix)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/components/ItemRow.tsx` - Added `selectOpenRef`, `onOpenChange` wiring, and blur guard

## Decisions Made

- The fix belongs entirely in `ItemRow`'s blur logic, not in `select.tsx`. The Portal is correct behavior for a dropdown — consumers of portaled controls must guard their focus-scope blur handlers.
- `onOpenChange` fires synchronously on open/close, so setting `selectOpenRef.current` before the async `setTimeout(0)` blur check runs is safe.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `@base-ui/react` `SelectRoot.Props` type confirms `onOpenChange: (open: boolean, eventDetails: SelectRootChangeEventDetails) => void` — the implementation matches the type signature exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Category Select in inline edit mode now works correctly end-to-end.
- UAT test 6 (edit category) should now pass.
- No blockers for remaining phase work.

---
*Phase: 02-list-management*
*Completed: 2026-05-25*

## Self-Check: PASSED

- src/components/ItemRow.tsx: FOUND
- .planning/phases/02-list-management/02-05-SUMMARY.md: FOUND
- Task commit c3c6f3a: FOUND
- Docs commit 26d8b5a: FOUND
