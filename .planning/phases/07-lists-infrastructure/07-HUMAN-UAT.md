---
status: partial
phase: 07-lists-infrastructure
source: [07-VERIFICATION.md]
started: 2026-05-28T23:36:00Z
updated: 2026-05-28T23:36:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end list creation (LIST-01)
expected: List row appears immediately (optimistic); link navigates to /list/:share_code; list persists on refresh
result: [pending]

### 2. Cross-page live name propagation (LIST-02, D-06)
expected: Inline rename saves; LandingPage row updates; navigating to /list/:code shows the new name in the header
result: [pending]

### 3. Delete dialog flow from lists-home (LIST-03, D-08)
expected: (a) Trash2 opens dialog showing "and all its items" copy; (c) Cancel leaves list intact; (d) Delete removes the row
result: [pending]

### 4. Delete from within ListPage and redirect (LIST-03, D-08)
expected: Dialog shows "This removes the list and all its items permanently."; confirming navigates to / and the old list URL returns "List not found"
result: [pending]

### 5. Owner guard — isOwner false for non-owners (D-05/D-10)
expected: Rename and delete Pencil/Trash2 buttons do NOT appear for a non-owner; list content still viewable
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
