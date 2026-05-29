---
phase: "09"
plan: "03"
subsystem: sidebar-profile
tags: [profile, avatar, display-name, sign-out, auth]
dependency_graph:
  requires: [09-01]
  provides: [sidebar-profile-slot]
  affects: [AppShell, Sidebar, authStore]
tech_stack:
  added: []
  patterns: [inline-edit, avatar-with-fallback, optimistic-update, drawer-close-before-redirect]
key_files:
  created: []
  modified:
    - src/components/Sidebar.tsx
    - src/components/AppShell.tsx
    - src/components/Sidebar.test.tsx
decisions:
  - "ProfileSection extracted as a local sub-component inside Sidebar.tsx for clarity (not exported)"
  - "useAuthStore.getState() used inside handlers to avoid stale closure capture"
  - "authError checked after updateDisplayName await via getState().error (not selector) to read post-call state"
metrics:
  duration: "15 minutes"
  completed: "2026-05-29"
  tasks: 2
  files: 3
---

# Phase 9 Plan 03: Sidebar Profile Section Summary

**One-liner:** Filled Sidebar profile slot with Google avatar + display name inline edit + sign-out using display_name ?? full_name ?? name ?? email fallback chain.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update AppShell to pass user prop to Sidebar | fc2d090 | AppShell.tsx |
| 2 | Build Sidebar profile section | fc2d090 | Sidebar.tsx, Sidebar.test.tsx |

## What Was Built

**AppShell.tsx:** Single-prop addition — `user={user}` added to Sidebar render (user was already in scope from authStore).

**Sidebar.tsx:**
- Added `user: User | null` to SidebarProps interface
- Local `resolveDisplayName(user)` helper: `display_name ?? full_name ?? name ?? email.split('@')[0] ?? 'User'`
- `ProfileSection` sub-component (local, not exported) with:
  - 40px avatar `<img>` with `referrerPolicy="no-referrer"` and initials fallback on error
  - Read mode: avatar + name + pencil button row (`flex items-center gap-3 mb-2 min-h-[44px]`)
  - Edit mode: Input (autoFocus, aria-label="Display name") + "Save name" (disabled when empty) + "Cancel"
  - `handleSignOut`: calls `onOpenChange(false)` first, then `authStore.signOut()` — drawer closes before redirect
  - Error text below input when authStore.error set after save attempt
- `data-slot="profile-slot"` div filled with `{user && <ProfileSection ... />}`

**Sidebar.test.tsx:** Updated `renderOpenSidebar` to accept optional user param; added `vi.mock('@/stores/authStore')` with `mockUpdateDisplayName` and `mockSignOut`; added `getState` mock on `useAuthStore`. 8 new profile section tests added covering all PROF-01/02/03 behaviors.

## Verification

- `npx vitest run src/components/Sidebar.test.tsx`: 12/12 passed (4 existing + 8 new)
- `npx tsc --noEmit`: clean (no output)

## Deviations from Plan

**1. [Rule 2 - Missing Critical] authError checked via getState() after save**
- The plan's handleSave pattern used `authStore.error` to check for error after `updateDisplayName`.
- Since `useAuthStore` selector runs at render time, checking `useAuthStore.getState().error` immediately after the async call ensures we read the post-call state, not the stale render value.
- No behavioral change — same correctness requirement.

**2. Tasks 1 and 2 committed together**
- Plan note stated "TypeScript will error until Task 2 adds user to SidebarProps" — both tasks were committed in one atomic commit (`fc2d090`) to keep the tree always compilable.

## Threat Surface Scan

All threats from STRIDE register addressed:
- T-09-03-01: Display name rendered via JSX text content only — no dangerouslySetInnerHTML
- T-09-03-02: handleSignOut uses hardcoded `onOpenChange(false)` + `authStore.signOut()` — no user-supplied URL
- T-09-03-03: avatarUrl only from server-controlled `user_metadata`
- T-09-03-04: Save button `disabled={!editName.trim()}` enforced

No new threat surface introduced beyond the plan's threat model.

## Self-Check: PASSED

- [x] src/components/Sidebar.tsx — exists with ProfileSection and profile-slot filled
- [x] src/components/AppShell.tsx — user={user} prop passed to Sidebar
- [x] src/components/Sidebar.test.tsx — 12 tests, all green
- [x] Commit fc2d090 — verified in git log
