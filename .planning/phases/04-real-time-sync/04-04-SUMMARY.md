---
phase: 04-real-time-sync
plan: "04"
subsystem: ui
tags: [zustand, supabase-realtime, navigator-online, window-events, syncstatus]

# Dependency graph
requires:
  - phase: 04-real-time-sync/03
    provides: SyncStatus pill component and subscribeToList lifecycle
provides:
  - "Immediate offline detection via window 'offline' event (sub-1s vs 25-50s WebSocket heartbeat)"
  - "Full re-subscribe recovery on window 'online' event"
  - "Belt-and-suspenders syncStatus guard on all 5 mutation error paths"
affects: [05-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useItemsStore.setState() from event handlers (avoids adding store actions)"
    - "!navigator.onLine ternary guard in mutation error set() calls"

key-files:
  created: []
  modified:
    - src/pages/ListPage.tsx
    - src/stores/itemsStore.ts
    - src/pages/ListPage.test.tsx
    - src/stores/itemsStore.test.ts

key-decisions:
  - "Used useItemsStore.setState() instead of adding a setSyncStatus action to the store interface"
  - "handleOnline calls subscribeToList (not bare fetchItems) for full recovery path"

patterns-established:
  - "Window offline/online event pattern: setState from event handler, subscribeToList for recovery"
  - "Mutation-offline guard: syncStatus ternary in every error set() call"

requirements-completed: [SYNC-03]

# Metrics
duration: 5min
completed: 2026-05-26
---

# Phase 04 Plan 04: Offline/Online SyncStatus Gap Closure Summary

**Immediate offline detection via window events + belt-and-suspenders mutation-offline syncStatus guards on all 5 store actions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-26T15:29:17Z
- **Completed:** 2026-05-26T15:33:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SyncStatus pill now transitions to 'Reconnecting...' within ~1 second of network drop (was 25-50s via WebSocket heartbeat)
- Online handler re-subscribes (full recovery path) instead of bare fetchItems
- All 5 mutation error paths (addItem, updateItem, deleteItem, toggleChecked, clearChecked) set syncStatus to 'reconnecting' when navigator.onLine is false
- 8 new tests covering all offline/online behaviors, all 78 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for offline/online behaviors** - `885c162` (test)
2. **Task 1 (GREEN): Implementation + mock fix** - `3b307b1` (feat)
3. **Task 2: Update online handler test to verify re-subscribe** - `0cd8574` (test)

_TDD cycle: RED (failing tests) -> GREEN (implementation) -> commit per phase_

## Files Created/Modified
- `src/pages/ListPage.tsx` - Added handleOffline (sets 'reconnecting') and updated handleOnline (sets 'connecting' + re-subscribes)
- `src/stores/itemsStore.ts` - Added !navigator.onLine syncStatus guard to 5 mutation error paths
- `src/pages/ListPage.test.tsx` - Added 2 new tests for offline/online syncStatus handlers, updated existing online test
- `src/stores/itemsStore.test.ts` - Added 7 new tests for mutation-offline guards, extended mock with insert/select/thenable chains

## Decisions Made
- Used `useItemsStore.setState()` static method from event handlers rather than adding a `setSyncStatus` action to the store interface -- follows existing pattern used by tests and avoids expanding the store API
- Replaced bare `fetchItems()` call in handleOnline with `subscribeToList()` -- re-subscribing triggers the full SUBSCRIBED -> 'live' -> fetchItems flow, making bare fetchItems redundant

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing online handler test to match new behavior**
- **Found during:** Task 2 (test verification)
- **Issue:** Existing "calls fetchItems on window online event (SYNC-02)" test failed because handleOnline now calls subscribeToList instead of bare fetchItems
- **Fix:** Updated test to verify supabase.channel calls (subscribeToList) instead of mockOrder calls (fetchItems)
- **Files modified:** src/pages/ListPage.test.tsx
- **Verification:** All 78 tests pass
- **Committed in:** 0cd8574 (Task 2 commit)

**2. [Rule 3 - Blocking] Extended Supabase mock with thenable delete chain for deleteItem tests**
- **Found during:** Task 1 GREEN phase
- **Issue:** Existing mock's `.delete().eq()` returned `{ eq: fn }` (object) not a Promise; deleteItem uses single `.eq()` chain and `await` needs a thenable
- **Fix:** Made first `.eq()` return value both thenable and has `.eq()` method for double-eq chains
- **Files modified:** src/stores/itemsStore.test.ts
- **Verification:** All deleteItem and clearChecked tests pass
- **Committed in:** 3b307b1 (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## TDD Gate Compliance
- RED gate: `885c162` (test commit with 7 failing tests)
- GREEN gate: `3b307b1` (feat commit, all tests pass)
- REFACTOR gate: Not needed (code is clean as-is)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 04 UAT blocker resolved: SyncStatus pill now accurately reflects network state
- All 78 tests pass, TypeScript clean
- Ready for Phase 05 (deploy) or phase verification

---
*Phase: 04-real-time-sync*
*Completed: 2026-05-26*
