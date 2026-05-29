---
status: partial
phase: 09-auth-integration-into-listpage
source: [09-VERIFICATION.md]
started: 2026-05-29T12:50:00Z
updated: 2026-05-29T12:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar avatar renders from Google (PROF-02)
expected: Open the sidebar after Google sign-in — a circular 40px Google avatar photo renders (not an initials circle). In DevTools Network, the avatar img request has no Referer header.
result: [pending]

### 2. Display name edit + persistence (PROF-01)
expected: Tap the pencil in the sidebar, change name to "Test Name", tap "Save name". (a) sidebar immediately shows "Test Name", (b) own items' attribution updates live, (c) after page refresh the name persists.
result: [pending]

### 3. Avatar on own items (PROF-02)
expected: Add a new item while signed in — the 28px attribution badge shows your Google avatar (not an initials circle). Note: a freshly-added item may briefly show the initials badge for ~200ms before flipping to the avatar (known optimistic-window behavior).
result: [pending]

### 4. Sign out sequence (PROF-03)
expected: Tap "Sign out" in the sidebar — (a) the drawer closes immediately, (b) redirect to the login page `/`, (c) the sidebar is not visible over the login screen.
result: [pending]

### 5. Share code re-expand (NAV-03)
expected: Dismiss the share-code banner via the × button — a Share2 icon appears in the header. Tap it — the banner reappears and the Share2 icon disappears. Lossless both directions.
result: [pending]

### 6. No name prompt (D-10)
expected: Navigate to any list while signed in — no name-prompt dialog appears, the AddItemBar input is active, and added items show your auth display name as attribution.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
