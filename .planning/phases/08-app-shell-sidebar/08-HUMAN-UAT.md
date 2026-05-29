---
status: partial
phase: 08-app-shell-sidebar
source: [08-VERIFICATION.md]
started: 2026-05-29T09:30:00Z
updated: 2026-05-29T09:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drawer slide animation + focus restoration
expected: Click the hamburger on a list page → drawer slides in from the left in ~200ms. Press Escape → drawer slides out and focus returns to the hamburger button.
result: [pending]

### 2. Active row visual distinctness
expected: The currently viewed list row shows a distinct background fill (bg-sidebar-accent) and heavier font weight (font-semibold) versus the other rows.
result: [pending]

### 3. Row tap navigates + closes simultaneously
expected: Tapping a non-active list row changes the URL to that list AND closes the drawer in a single interaction.
result: [pending]

### 4. Mobile/desktop layout without breakage
expected: At 375px and 1280px viewports the drawer overlays content (no persistent rail, max width ~80vw / 288px), background content is not pushed, and no stray scrollbar appears.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
