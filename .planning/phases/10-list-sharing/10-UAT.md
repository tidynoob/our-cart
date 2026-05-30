---
status: complete
phase: 10-list-sharing
source: [10-00-SUMMARY.md, 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md]
started: 2026-05-30T21:37:44Z
updated: 2026-05-30T21:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server, start fresh, log in. App boots without errors, lists load from Supabase, list page shows live data.
result: issue
reported: "lists are loading, but both my gmail accounts can see all the lists from supabase that have null owner_id"
severity: major

### 2. Copy Share Link
expected: Open a list you own. ShareBanner shows a share control. Click Copy link — clipboard now holds an /invite/<code> URL (not /list/<code>).
result: pass

### 3. Redeem Valid Invite
expected: While logged in as the partner (second account), open the copied /invite/<code> link. Brief spinner, then you're redirected to /list/<code> showing the shared list's items.
result: pass

### 4. Shared List In Partner Sidebar
expected: After joining via invite, the partner's sidebar shows the shared list alongside their own. Reload — it persists (RLS membership, not owner filter).
result: pass

### 5. Invalid Invite Link
expected: Open /invite/BADCODE (a code that does not exist). Page shows "This invite link is invalid or has expired." — no crash, no redirect.
result: pass

### 6. Unauthenticated Partner Join
expected: Log out. Open an /invite/<code> link. You're sent through OAuth login, then returned and joined to the list, landing on /list/<code>.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "After login, an authenticated user sees only their own lists and lists they are a member of — not lists belonging to other users."
  status: failed
  reason: "User reported: lists are loading, but both my gmail accounts can see all the lists from supabase that have null owner_id"
  severity: major
  test: 1
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis
