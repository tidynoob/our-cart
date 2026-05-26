---
phase: 04-real-time-sync
plan: "02"
subsystem: realtime
tags: [supabase, realtime, zustand, websocket, postgres-changes, vitest]

# Dependency graph
requires:
  - phase: 04-01
    provides: "itemsStore stub stubs for subscribeToList/unsubscribe + channel mock in itemsStore.test.ts"
  - phase: 01-foundation
    provides: "items table in Supabase with RLS policies; supabase client in src/lib/supabase.ts"
provides:
  - "itemsStore.subscribeToList(listId): opens Postgres Changes channel, runs idempotent merge reducer, manages syncStatus"
  - "itemsStore.unsubscribe(): removeChannel cleanup, resets channel/syncStatus"
  - "itemsStore.syncStatus: 'connecting' | 'live' | 'reconnecting' state field"
  - "supabase.ts createClient with realtime: { worker: true } for heartbeat resilience"
  - "All itemsStore SYNC unit tests passing (18 tests, 0 todos)"
affects:
  - "04-03 — ListPage lifecycle wiring and SyncStatus component read from subscribeToList/unsubscribe/syncStatus"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent merge reducer: INSERT upsert-by-id, UPDATE replace-by-id, DELETE remove-by-payload.old.id"
    - "fetchInFlight module-level guard prevents redundant fetchItems on simultaneous wakeup events"
    - "String literals for channel status ('SUBSCRIBED' etc.) instead of REALTIME_SUBSCRIBE_STATES enum (import-path stable)"
    - "supabase.removeChannel(channel) for full cleanup (not channel.unsubscribe() alone)"

key-files:
  created: []
  modified:
    - src/lib/supabase.ts
    - src/stores/itemsStore.ts
    - src/stores/itemsStore.test.ts

key-decisions:
  - "Used string literals ('SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED') instead of REALTIME_SUBSCRIBE_STATES enum to avoid import-path uncertainty (RESEARCH Open Question 1)"
  - "worker: true confirmed in RealtimeClientOptions type definition — included without cast"
  - "fetchInFlight guard: module-level let flag cleared in .finally() — prevents triple fetch on simultaneous visibilitychange + online + SUBSCRIBED"
  - "INSERT echo guard: state.items.some(i => i.id === id) check — own-write echoes are silent no-ops (D-03)"

patterns-established:
  - "Merge reducer inline in subscribeToList (not extracted) — keeps set() closure access to current state without stale closure risk"
  - "unsubscribe resets to syncStatus='connecting' (not 'disconnected') — consistent with initial state"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03]

# Metrics
duration: 3min
completed: 2026-05-26
---

# Phase 04 Plan 02: Real-Time Sync Store Implementation Summary

**Zustand itemsStore gains subscribeToList/unsubscribe with Postgres Changes merge reducer (INSERT/UPDATE/DELETE idempotent by id) and supabase.ts gains realtime worker:true heartbeat resilience**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-26T14:12:27Z
- **Completed:** 2026-05-26T14:15:00Z
- **Tasks:** 1 executed (Task 1 pre-confirmed by user; Task 2 implemented)
- **Files modified:** 3

## Accomplishments

- Task 1 (publication enablement): confirmed by user before this agent ran — items table is in supabase_realtime publication
- Task 2 (store implementation): subscribeToList/unsubscribe/syncStatus/channel fully implemented with idempotent merge reducer, fetchInFlight guard, and correct channel cleanup
- supabase.ts enhanced with `realtime: { worker: true }` — heartbeat routed via Web Worker for mobile Safari screen-lock resilience
- All 12 new itemsStore SYNC unit tests pass (4 subscribeToList, 2 unsubscribe, 6 mergeReducer); 0 .todo remaining in SYNC describe blocks
- Full test suite: 64 passed, 0 failures

## Task Commits

1. **Task 1: Enable Realtime publication** — pre-confirmed by user (no commit needed)
2. **Task 2: subscribeToList + unsubscribe + tests** — `37b426e` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `src/lib/supabase.ts` — added `realtime: { worker: true }` to createClient options
- `src/stores/itemsStore.ts` — replaced stub subscribeToList/unsubscribe with full implementation; added fetchInFlight guard
- `src/stores/itemsStore.test.ts` — replaced all 12 .todo stubs with passing test implementations

## Decisions Made

- String literals for subscribe status values (not REALTIME_SUBSCRIBE_STATES enum) — avoids import path uncertainty; both work equivalently at runtime
- `worker: true` included directly (not cast) — confirmed present in RealtimeClientOptions type definition in the installed supabase-js 2.106.1
- fetchInFlight guard placed at module scope (not store state) — ephemeral guard, not persisted state; pattern matches RESEARCH §Resync Guard exactly
- INSERT echo guard uses `state.items.some(i => i.id === id)` — own-write dedup for addItem's temp-id replacement flow (D-03)

## Deviations from Plan

None — plan executed exactly as written. TypeScript was clean without any casts. String literal fallback for status values was pre-planned and used as designed.

## Issues Encountered

None.

## User Setup Required

Task 1 was a blocking manual prerequisite: the user ran `alter publication supabase_realtime add table items;` in the Supabase SQL Editor and confirmed the items table now appears in supabase_realtime. This was completed before this agent ran and is documented here as confirmed.

## Next Phase Readiness

- Plan 04-03 can now wire ListPage lifecycle: call subscribeToList(list.id) in useEffect, call unsubscribe() in cleanup, attach visibilitychange/online handlers, and mount the SyncStatus component reading syncStatus from the store
- All store-level real-time functionality is complete and tested
- No blockers

---
*Phase: 04-real-time-sync*
*Completed: 2026-05-26*
