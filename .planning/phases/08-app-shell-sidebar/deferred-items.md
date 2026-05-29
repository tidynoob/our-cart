# Deferred Items — Phase 08 App Shell & Sidebar

## Pre-existing Test Failures (Out of Scope)

These failures existed before Phase 08 Plan 01 work and are unrelated to AppShell/Sidebar/router changes:

### NamePromptDialog.test.tsx (3 failures)
- `calls onNameSaved with trimmed name when Save is clicked`
- `persists trimmed name to localStorage on Save click`
- `calls onNameSaved when Enter is pressed in the input`
- **Root cause:** `localStorage` is `undefined` in the test environment — the component calls `localStorage.setItem()` without a guard. The test environment doesn't mock `localStorage`.
- **Discovered at:** Phase 08 Plan 01 full suite run
- **Impact:** Pre-existing; not introduced by Plan 01 changes

### ListPage.test.tsx (10 failures)
- Multiple tests failing due to `localStorage.getItem()` returning undefined
- **Root cause:** Same `localStorage` availability issue in jsdom test environment
- **Discovered at:** Phase 08 Plan 01 full suite run
- **Impact:** Pre-existing; not introduced by Plan 01 changes
