---
status: complete
phase: 02-list-management
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-05-25T14:30:00.000Z
updated: 2026-05-25T14:40:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. End-to-end add item flow
expected: Add item via AddItemBar and confirm visual rendering with Supabase persistence
result: pass

### 2. Focus-scope inline edit
expected: Clicking between edit fields (name, qty, category, trash, cancel) does NOT trigger premature save; save only fires when focus leaves entire row or Enter pressed
result: pass

### 3. Delete confirmation flow
expected: Tap trash icon -> "Delete this item?" inline confirmation -> Cancel reverts, Delete removes item
result: pass

### 4. Name prompt dialog
expected: First visit to list shows name prompt; name persists in localStorage across reloads; dialog dismisses after saving name
result: issue
reported: "when refreshing the page, it asks what my name is again (which it really shouldn't do), but also when I type anything and save the tile does not go away"
severity: blocker

### 5. Supabase schema migration
expected: added_by column visible in items table; 4 RLS policies exist (select, insert, update, delete)
result: pass

### 6. iOS zoom prevention
expected: All text inputs render at 16px+ font size; no zoom-on-focus on iOS Safari
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "First visit to list shows name prompt; name persists in localStorage across reloads; dialog dismisses after saving name"
  status: failed
  reason: "User reported: when refreshing the page, it asks what my name is again (which it really shouldn't do), but also when I type anything and save the tile does not go away"
  severity: blocker
  test: 4
  root_cause: "@base-ui/react v1.5.0 Button forces type='button' on rendered element, overriding type='submit'. Form onSubmit never fires, so localStorage.setItem and onNameSaved never execute."
  artifacts:
    - path: "src/components/NamePromptDialog.tsx"
      line: 50
      issue: "Button type='submit' overridden by @base-ui/react internals — form submission never triggers"
  missing:
    - "Use onClick handler on Button instead of relying on form submit, or use plain <button type='submit'>"
  debug_session: ".planning/debug/name-dialog-persist-close.md"
