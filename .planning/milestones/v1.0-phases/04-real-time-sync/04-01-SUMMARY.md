---
phase: "04-real-time-sync"
plan: "01"
subsystem: "test-scaffold"
tags: ["testing", "vitest", "supabase-mock", "realtime", "wave-0"]
dependency_graph:
  requires: []
  provides:
    - "itemsStore.test.ts channel mock with capturedSubscribeCb pattern"
    - "12 it.todo stubs covering subscribeToList (x4), unsubscribe (x2), mergeReducer (x6)"
    - "SyncStatus.test.tsx with 3 it.todo stubs for live/connecting/reconnecting"
    - "ListPage.test.tsx channel mock + 2 it.todo stubs for visibilitychange/online"
    - "ItemsState interface extended with syncStatus, channel, subscribeToList, unsubscribe (stub impls)"
  affects:
    - "src/stores/itemsStore.ts (interface + stub actions)"
    - "src/stores/itemsStore.test.ts"
    - "src/pages/ListPage.test.tsx"
    - "src/components/SyncStatus.test.tsx"
tech_stack:
  added: []
  patterns:
    - "vi.hoisted() to declare mock variables before vi.mock() factory hoisting"
    - "capturedSubscribeCb via hoisted closure to trigger status strings in tests"
    - "it.todo() stubs for Wave 0 gap coverage without requiring implementation"
key_files:
  created:
    - "src/components/SyncStatus.test.tsx"
  modified:
    - "src/stores/itemsStore.test.ts"
    - "src/stores/itemsStore.ts"
    - "src/pages/ListPage.test.tsx"
decisions:
  - "Used vi.hoisted() to resolve Vitest mock hoisting issue — factory runs before variable declarations"
  - "SyncStatus.test.tsx uses it.todo only (component import commented out) to keep suite green until Plan 04-03"
  - "ItemsState interface extended with syncStatus/channel types and stub subscribeToList/unsubscribe to satisfy TypeScript in test setState() calls"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-05-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 04 Plan 01: Wave 0 Test Scaffold Summary

**One-liner:** Supabase channel mock via vi.hoisted() + 17 it.todo stubs covering all SYNC-01/02/03 behaviors across three test files

## What Was Built

This plan created the Wave 0 test scaffold for Phase 4 real-time sync. The purpose is to have the full test surface in place before implementation begins, so Plans 04-02 and 04-03 can drive development test-first.

### Task 1: itemsStore.test.ts channel mock + SYNC stubs

Extended `src/stores/itemsStore.test.ts` with:

- `vi.hoisted()` block declaring `mockChannelOn`, `mockChannelSubscribe`, `mockRemoveChannel`, and a closure-based `capturedSubscribeCb` accessor pattern — required because `vi.mock()` is hoisted above variable declarations
- Extended `vi.mock('@/lib/supabase')` factory to include `channel()` (returns `{on, subscribe}`) and `removeChannel` alongside the existing `from` mock
- All `beforeEach` blocks updated to include `syncStatus: 'connecting'` and `channel: null` in `setState()`, plus `resetCapturedCb()` calls
- Three new `describe` blocks with `it.todo` stubs:
  - `itemsStore — subscribeToList`: 4 stubs (SUBSCRIBED→live, CHANNEL_ERROR/TIMED_OUT/CLOSED→reconnecting)
  - `itemsStore — unsubscribe`: 2 stubs (removeChannel call, channel null + syncStatus reset)
  - `itemsStore — mergeReducer`: 6 stubs (INSERT add, INSERT echo no-op, UPDATE replace, DELETE by id, DELETE partial payload, multiple DELETE)

Also extended `src/stores/itemsStore.ts` to satisfy TypeScript:
- Added `RealtimeChannel` import from `@supabase/supabase-js`
- Extended `ItemsState` interface with `syncStatus`, `channel`, `subscribeToList`, `unsubscribe`
- Added initial state values (`syncStatus: 'connecting'`, `channel: null`)
- Added no-op stub implementations for `subscribeToList` and `unsubscribe` (full implementation in Plan 04-02)

### Task 2: ListPage.test.tsx + SyncStatus.test.tsx

Extended `src/pages/ListPage.test.tsx`:
- Added `channel()` and `removeChannel` to the supabase vi.mock — `subscribe` calls `setTimeout(() => cb('SUBSCRIBED'), 0)` so tests don't hang
- Updated the clear-completed `beforeEach` to include `syncStatus: 'connecting'` and `channel: null`
- Added new `describe('ListPage — reconnect event handlers')` with 2 `it.todo` stubs for visibilitychange and online handlers (SYNC-02)

Created `src/components/SyncStatus.test.tsx`:
- Mocks `useItemsStore` as a selector-compatible `vi.fn()` returning `{ syncStatus: 'live' }`
- Three `it.todo` stubs for live/connecting/reconnecting state renders (SYNC-03)
- Component import commented out (SyncStatus.tsx created in Plan 04-03) — keeps suite green

## Verification Results

- `npx vitest run --reporter=verbose`: 52 pass, 17 todo, 0 failures (exit 0)
- `npx tsc --noEmit`: exit 0 (no TypeScript errors)
- `grep -c "it.todo" src/stores/itemsStore.test.ts`: 12
- `grep -c "removeChannel" src/pages/ListPage.test.tsx`: 1
- `grep -c "it.todo" src/components/SyncStatus.test.tsx`: 3

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.hoisted() required for channel mock variables**
- **Found during:** Task 1
- **Issue:** Vitest hoists `vi.mock()` factory to the top of the file, so `mockChannelOn`, `mockChannelSubscribe`, and `mockRemoveChannel` (declared as module-level `const`) were not yet initialized when the factory ran. Error: "Cannot access 'mockChannelOn' before initialization"
- **Fix:** Wrapped all channel mock variables in `vi.hoisted()` and exported them via a closure accessor pattern (`getCapturedCb`, `resetCapturedCb`). This is the documented Vitest pattern for mock variables that the factory needs.
- **Files modified:** `src/stores/itemsStore.test.ts`
- **Commit:** `34450a8`

**2. [Rule 2 - Missing Critical Functionality] ItemsState interface must include syncStatus/channel for test setState() calls**
- **Found during:** Task 1
- **Issue:** Test `beforeEach` blocks set `syncStatus: 'connecting'` and `channel: null` via `useItemsStore.setState()`. TypeScript rejects unknown keys on the `ItemsState` type. Without the interface extension, `npx tsc --noEmit` would fail.
- **Fix:** Extended `ItemsState` with `syncStatus`, `channel`, `subscribeToList`, and `unsubscribe`. Added stub implementations so the store object satisfies its interface. Plan 04-02 replaces the stubs with real implementations.
- **Files modified:** `src/stores/itemsStore.ts`
- **Commit:** `34450a8`

**3. [Rule 3 - Blocking] SyncStatus component import omitted from test file**
- **Found during:** Task 2
- **Issue:** `SyncStatus.tsx` does not exist until Plan 04-03. Importing it would cause a module-not-found error and break the suite.
- **Fix:** Used `it.todo()` stubs as the plan specifies, and commented out the import with a clear note. The file still establishes the correct mock structure and describe block for Plan 04-03 to un-comment.
- **Files modified:** `src/components/SyncStatus.test.tsx`
- **Commit:** `380e41d`

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `src/stores/itemsStore.ts` | `subscribeToList` no-op | Full implementation in Plan 04-02 |
| `src/stores/itemsStore.ts` | `unsubscribe` no-op | Full implementation in Plan 04-02 |
| `src/components/SyncStatus.test.tsx` | Import commented out | Component created in Plan 04-03 |

These stubs are intentional Wave 0 scaffolding — they exist to make the test structure compile while implementation is deferred.

## Threat Flags

None. This plan only modifies test files and adds type-only stub implementations. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `src/stores/itemsStore.test.ts` exists and has 12 it.todo stubs
- `src/pages/ListPage.test.tsx` has channel mock with removeChannel
- `src/components/SyncStatus.test.tsx` exists with 3 it.todo stubs
- Commits verified: `34450a8` (Task 1), `380e41d` (Task 2)
- `npx vitest run --reporter=verbose` exits 0 with no regressions
- `npx tsc --noEmit` exits 0
