---
phase: "09"
plan: "04"
subsystem: auth-integration
tags: [cleanup, integration, d-10, nav-03, attribution]
dependency_graph:
  requires: ["09-01", "09-02", "09-03"]
  provides: ["ListPage-auth-clean", "CategorySection-user-threading", "Share2-reexpand"]
  affects: ["ListPage", "AddItemBar", "CategorySection", "ItemRow"]
tech_stack:
  added: []
  patterns: ["resolveDisplayName helper", "Zustand setState in tests", "auth-store-seeded tests"]
key_files:
  created: []
  modified:
    - src/pages/ListPage.tsx
    - src/components/AddItemBar.tsx
    - src/components/AddItemBar.test.tsx
    - src/components/CategorySection.tsx
    - src/pages/ListPage.test.tsx
  deleted:
    - src/components/NamePromptDialog.tsx
    - src/components/NamePromptDialog.test.tsx
decisions:
  - "resolveDisplayName scoped as component-local helper (display_name ?? full_name ?? name ?? email.split('@')[0] ?? 'Unknown')"
  - "ListPage test mocking via useAuthStore.setState + useUIStore.setState instead of vi.mock — consistent with itemsStore pattern"
  - "Share2 button placed after SyncStatus in header row per UI-SPEC.md spec"
metrics:
  duration: "18 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  files_changed: 7
---

# Phase 9 Plan 04: D-10 Cleanup + D-11 Re-Expand + Attribution Threading Summary

**One-liner:** Retired NamePromptDialog + localStorage name model; wired auth display name into AddItemBar and CategorySection → ItemRow attribution chain; added Share2 re-expand affordance in ListPage header.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove NamePromptDialog, retire localStorage name, clean AddItemBar (D-10) | c593e92 | ListPage.tsx, AddItemBar.tsx, AddItemBar.test.tsx |
| 2 | Thread current-user props + Share2 re-expand + delete NamePromptDialog files + update tests | 4144e3d | CategorySection.tsx, ListPage.tsx, ListPage.test.tsx, NamePromptDialog.{tsx,test.tsx} deleted |
| 3 | Human-verify checkpoint (auto-approved — auto mode active) | — | — |

## What Was Built

**D-10 Cleanup (Task 1):**
- Removed `NamePromptDialog` import and JSX render from `ListPage.tsx`
- Removed `userName` state and `localStorage.getItem(our-cart-name-${list.id})` block
- Added `resolveDisplayName(user: User): string` helper in ListPage (display_name ?? full_name ?? name ?? email.split('@')[0] ?? 'Unknown')
- AddItemBar now receives `addedBy={resolveDisplayName(user!)}` — always non-empty for authenticated users
- Removed `disabled` prop from `AddItemBarProps` interface and `isInert = submitting || disabled` logic → `isInert = submitting` only

**D-04/D-06 Attribution Threading (Task 2):**
- `CategorySection`: added `currentUserId?: string | null`, `currentUserDisplayName?: string`, `currentUserAvatarUrl?: string | null` to interface and destructuring; threads all three to each `ItemRow` in the map
- `ListPage`: derives `currentUserDisplayName` and `currentUserAvatarUrl` from `user.user_metadata`; passes `currentUserId={user?.id ?? null}` to each CategorySection render

**D-11 / NAV-03 Re-Expand (Task 2):**
- Added `Share2` to lucide-react import in ListPage
- Added `restoreBanner` selector from `useUIStore`
- Share2 ghost icon button rendered after `<SyncStatus />` in header row, visible only when `dismissedBanners.has(list.share_code)`; `onClick={() => restoreBanner(list.share_code)}`; `aria-label="Show share code"`

**NamePromptDialog deletion (Task 2):**
- `src/components/NamePromptDialog.tsx` — deleted
- `src/components/NamePromptDialog.test.tsx` — deleted
- No remaining import or usage references in `src/` (confirmed by grep)

**Test updates:**
- `ListPage.test.tsx`: replaced localStorage-based NamePromptDialog workarounds with `useAuthStore.setState({ user: makeUser(), ... })` + `useUIStore.setState({ dismissedBanners: new Set() })` in all `beforeEach` blocks
- Added `makeUser()` helper for minimal test User object
- Added describe block `ListPage — D-10/NAV-03` with 5 new tests: D-10 no-prompt assertion, D-10 addedBy from auth, NAV-03 Share2 absent when banner visible, NAV-03 Share2 visible when dismissed, NAV-03 click calls restoreBanner

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run` | 161/161 tests PASSED (21 test files) |
| `npx tsc --noEmit` | CLEAN — no errors |
| `npm run build` | Pre-existing TS errors in itemsStore.ts + test files (user_id field, introduced by 09-02 plan, out of scope) |
| `grep -r "NamePromptDialog" src/` import/usage | 0 results — fully deleted |
| `restoreBanner` in uiStore.ts | 2 references (definition + implementation) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] AuthStore + UIStore mocks in ListPage.test.tsx**
- **Found during:** Task 2
- **Issue:** ListPage now reads `user` from `useAuthStore` (for `resolveDisplayName(user!)`) and `dismissedBanners` from `useUIStore`. Without seeding these stores in tests, `resolveDisplayName(null!)` would crash and banner visibility would be incorrect. The original tests used `localStorage.setItem` as a NamePromptDialog workaround — that workaround was no longer applicable.
- **Fix:** Added `useAuthStore.setState()` and `useUIStore.setState()` in all `beforeEach` blocks; removed `afterEach` localStorage cleanup. Added `makeUser()` helper for consistent test user objects.
- **Files modified:** `src/pages/ListPage.test.tsx`
- **Commit:** 4144e3d

### Out of Scope (Deferred Items)

Pre-existing TypeScript errors in `npm run build` (not `npx tsc --noEmit`):
- `src/stores/itemsStore.ts` — `user_id` field missing from optimistic item constructor (09-02 introduced the field requirement)
- `src/stores/itemsStore.test.ts` — Multiple test objects missing `user_id` field (09-02 scope)
- `src/lib/categories.test.ts` — Same `user_id` issue

These were present before this plan and are logged to deferred items. They do not affect the Vitest test suite (which passes 100%) because Vitest uses its own transpiler that skips type-checking.

## Known Stubs

None — all data is wired from auth state. `resolveDisplayName` has a 'Unknown' final fallback (not a stub; it's a safety net for edge cases).

## Threat Flags

No new threat surface introduced. Threats addressed:
- T-09-04-01: `resolveDisplayName` always returns non-empty string — 'Unknown' final fallback prevents empty `addedBy`
- T-09-04-03: localStorage name reads removed — auth display name is now the authoritative source

## Human Verification (Auto-Approved)

Checkpoint auto-approved due to `_auto_chain_active: true`. 6 manual verification checks deferred to `/gsd-verify-work` UAT:
1. PROF-02: Sidebar Google avatar at 40px
2. PROF-01: Display name edit → persists in Supabase user_metadata
3. PROF-02: Avatar on own items (28px attribution badge)
4. PROF-03: Sign out closes sidebar + redirects to login
5. NAV-03: Dismiss banner → Share2 appears → click → banner reappears
6. D-10: No name prompt dialog; AddItemBar active; auth name on added items

## Self-Check: PASSED

- [x] src/pages/ListPage.tsx modified — confirmed (no NamePromptDialog, resolveDisplayName present, Share2 present)
- [x] src/components/CategorySection.tsx modified — confirmed (currentUserId in interface)
- [x] src/components/AddItemBar.tsx modified — confirmed (no disabled prop)
- [x] src/components/NamePromptDialog.tsx deleted — confirmed
- [x] src/components/NamePromptDialog.test.tsx deleted — confirmed
- [x] Commit c593e92 exists — confirmed
- [x] Commit 4144e3d exists — confirmed
- [x] 161/161 tests GREEN — confirmed
- [x] npx tsc --noEmit clean — confirmed
