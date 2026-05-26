---
status: retest
phase: 04-real-time-sync
source: [04-VERIFICATION.md]
started: 2026-05-26
updated: 2026-05-26
---

## Current Test

[awaiting human re-test of gap closure fix]

## Tests

### 1. Two-device propagation within 2 seconds (SYNC-01)
expected: Open the same list URL in two browsers/devices. Add, edit, check, uncheck, delete, and clear-completed in one — each change appears in the other within 2 seconds.
result: pass

### 2. SyncStatus pill transitions (SYNC-03)
expected: Green "Live" pill when connected. On network drop the pill shows amber "Reconnecting…"; it returns to green "Live" after the connection recovers.
result: retest
reported: "Getting 'Failed to add item' and 'failed to update item' errors but not getting the 'reconnecting' symbol change"
fix_applied: "04-04 gap closure: added window offline/online event listeners + mutation-offline syncStatus guards"
severity: major

### 3. Mobile screen-lock → wake resync (SYNC-02)
expected: With the list open on a phone, lock the screen; partner adds an item; unlock — the new item appears without a manual refresh (visibilitychange resync). Same for network-drop → reconnect (online event).
result: pass

### 4. Confirm supabase_realtime publication includes items (SYNC-01 prerequisite)
expected: In Supabase SQL Editor, `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` returns a row for `items`. This is the #1 silent-failure mode if it is ever dropped.
result: pass

## Summary

total: 4
passed: 3
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "Green 'Live' pill when connected. On network drop the pill shows amber 'Reconnecting…'; it returns to green 'Live' after the connection recovers."
  status: fix-applied
  reason: "User reported: Getting 'Failed to add item' and 'failed to update item' errors but not getting the 'reconnecting' symbol change"
  severity: major
  test: 2
  root_cause: "syncStatus relies solely on Supabase WebSocket heartbeat timeout (25-50s delay). REST mutations fail instantly on network drop but never update syncStatus. No window 'offline' event listener exists for fast detection."
  artifacts:
    - path: "src/stores/itemsStore.ts"
      issue: "Mutation error handlers (addItem, updateItem, toggleChecked, deleteItem, clearChecked) don't set syncStatus on failure"
    - path: "src/pages/ListPage.tsx"
      issue: "No 'offline' event listener; 'online' handler calls fetchItems but doesn't touch syncStatus"
  missing:
    - "Add window.addEventListener('offline', ...) that sets syncStatus to 'reconnecting' immediately"
    - "In 'online' handler, set syncStatus to 'connecting' and re-subscribe (not just fetchItems)"
    - "Optionally: mutation error handlers check !navigator.onLine and set syncStatus to 'reconnecting'"
  debug_session: ".planning/debug/syncstatus-no-reconnecting.md"
