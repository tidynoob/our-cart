---
phase: "09"
plan: "02"
subsystem: components
tags: [attribution, avatar, google-oauth, prof-02, d-04, d-06, d-07]
dependency_graph:
  requires: ["09-01"]
  provides: ["09-03", "09-04"]
  affects: ["src/components/AttributionBadge.tsx", "src/components/ItemRow.tsx"]
tech_stack:
  added: []
  patterns: ["useState imgError guard for Google avatar fallback", "referrerPolicy=no-referrer on Google CDN img", "prop-driven current-user attribution in ItemRow"]
key_files:
  created: []
  modified:
    - src/components/AttributionBadge.tsx
    - src/components/AttributionBadge.test.tsx
    - src/components/ItemRow.tsx
    - src/components/ItemRow.test.tsx
decisions:
  - "referrerPolicy=no-referrer mandatory on all Google avatar img elements (Google CDN 403 without it)"
  - "showImg guard (avatarUrl && !imgError) prevents empty-src img render — onError never fires for undefined src"
  - "Attribution resolution: isOwnItem (item.user_id === currentUserId) → live name+avatarUrl; else added_by → initials; else '?' badge"
  - "IIFE pattern used in JSX for isOwnItem derivation — keeps attribution logic co-located and avoids hoisting variable into display-mode scope"
metrics:
  duration: "98s"
  completed: "2026-05-29"
  tasks: 2
  files: 4
---

# Phase 09 Plan 02: AttributionBadge Avatar Extension + ItemRow Live Attribution Summary

One-liner: Google avatar rendering with referrerPolicy guard and live own-item attribution by user_id match wired into AttributionBadge and ItemRow.

## What Was Built

**Task 1 — AttributionBadge avatarUrl prop (D-07, PROF-02)**

Extended the 29-line `AttributionBadge` component with:
- `avatarUrl?: string` prop
- `useState(false)` imgError fallback state
- `showImg = avatarUrl && !imgError` guard (prevents empty-src img render)
- `<img>` with `referrerPolicy="no-referrer"` (mandatory for Google CDN — returns 403 without it)
- `onError={() => setImgError(true)}` handler falls back to colored-initial badge
- `overflow-hidden` on wrapper to clip circular img
- Color `style` applied only when `!showImg` (avoids tinting avatar)

All 5 Wave 0 RED scaffold tests turned GREEN (tests 2 and 3 were RED, now all pass).

**Task 2 — ItemRow live attribution (D-04, D-05, D-06, PROF-02)**

Updated `ItemRow.tsx` with three optional props:
- `currentUserId?: string | null`
- `currentUserDisplayName?: string`
- `currentUserAvatarUrl?: string | null`

Attribution resolution logic (replaces old `item.added_by ? ... : "?"` binary):
1. `item.user_id != null && item.user_id === currentUserId` → own item → live name + avatarUrl
2. `item.added_by` → frozen snapshot → initials badge (no avatar)
3. else → `?` badge (aria-label "Unknown person added this")

`ItemRow.test.tsx` updated:
- Added `user_id: null` to `baseItem` (satisfies Item type after 09-01 added field)
- Added `describe('ItemRow — attribution (PROF-02/D-06)')` with 3 tests:
  - Own item (user_id match) → aria-label "Mitchell added this"
  - Non-own item (user_id differs) → aria-label "Alice added this"
  - null user_id → falls back to added_by branch

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| 1 | 8f5d1b6 | AttributionBadge.tsx | feat: avatarUrl prop + referrerPolicy + imgError fallback |
| 2 | d9d7197 | ItemRow.tsx, ItemRow.test.tsx | feat: live attribution + current-user props + 3 new tests |

## Test Results

```
AttributionBadge.test.tsx: 5/5 PASS
ItemRow.test.tsx:           7/7 PASS (4 existing + 3 new)
Combined:                  12/12 PASS
TypeScript (npx tsc --noEmit): CLEAN
```

## Deviations from Plan

**1. [Rule 1 - Style] IIFE pattern for attribution block instead of pre-hoisted variable**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified `const isOwnItem = ...` before the JSX block, but this variable would be in the display-mode scope alongside other variables. The IIFE `{(() => { ... })()}` pattern keeps the three-branch logic self-contained and avoids the `isOwnItem` variable being accessible outside the attribution JSX.
- **Fix:** Used IIFE in JSX. No behavior change — purely structural.
- **Files modified:** ItemRow.tsx

None — plan executed substantially as written. The IIFE is a minor structural choice that matches the same outcome.

## Threat Flags

None. All mitigations from the plan's threat register were applied:
- T-09-02-01: JSX props used (no dangerouslySetInnerHTML) — React escapes string props
- T-09-02-02: `referrerPolicy="no-referrer"` on every Google avatar img
- T-09-02-03: `isOwnItem = item.user_id != null && item.user_id === currentUserId` — both conditions required

## Known Stubs

None. `AttributionBadge` avatarUrl and ItemRow attribution are fully wired. ListPage (09-04) will thread the actual `currentUserId`/`currentUserDisplayName`/`currentUserAvatarUrl` values from `authStore.user` — ItemRow is ready to receive them.

## Self-Check: PASSED

- [x] `src/components/AttributionBadge.tsx` exists and updated
- [x] `src/components/ItemRow.tsx` exists and updated
- [x] `src/components/ItemRow.test.tsx` exists and updated
- [x] Commit 8f5d1b6 exists
- [x] Commit d9d7197 exists
- [x] 12/12 tests GREEN
- [x] TypeScript clean
