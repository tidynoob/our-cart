---
status: partial
phase: 04-real-time-sync
source: [04-VERIFICATION.md]
started: 2026-05-26
updated: 2026-05-26
---

## Current Test

[awaiting human testing]

## Tests

### 1. Two-device propagation within 2 seconds (SYNC-01)
expected: Open the same list URL in two browsers/devices. Add, edit, check, uncheck, delete, and clear-completed in one — each change appears in the other within 2 seconds.
result: [pending]

### 2. SyncStatus pill transitions (SYNC-03)
expected: Green "Live" pill when connected. On network drop the pill shows amber "Reconnecting…"; it returns to green "Live" after the connection recovers.
result: [pending]

### 3. Mobile screen-lock → wake resync (SYNC-02)
expected: With the list open on a phone, lock the screen; partner adds an item; unlock — the new item appears without a manual refresh (visibilitychange resync). Same for network-drop → reconnect (online event).
result: [pending]

### 4. Confirm supabase_realtime publication includes items (SYNC-01 prerequisite)
expected: In Supabase SQL Editor, `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` returns a row for `items`. This is the #1 silent-failure mode if it is ever dropped.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
