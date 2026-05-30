---
phase: 10-list-sharing
plan: "03"
subsystem: ui
tags: [react, react-router-dom, supabase, vitest]

requires:
  - phase: 10-02
    provides: redeem_invite RPC live in Supabase; router.tsx base structure

provides:
  - InvitePage.tsx: mount-effect calls redeem_invite RPC, navigates to /list/:code on success, shows invalid-invite state on null/error
  - /invite/:code route registered in router.tsx inside ProtectedRoute but outside AppShell
  - 5 InvitePage unit tests passing (converted from it.todo stubs)

affects: [10-04, 10-05]

tech-stack:
  added: []
  patterns:
    - "InvitePage: thin page component — direct supabase.rpc call, no store; useEffect+useNavigate pattern from ListPage analog"
    - "ProtectedRoute sibling placement: /invite/:code sits inside ProtectedRoute children array as sibling to AppShell route, not nested inside it"

key-files:
  created:
    - src/pages/InvitePage.tsx
  modified:
    - src/pages/InvitePage.test.tsx
    - src/router.tsx

key-decisions:
  - "InvitePage calls supabase.rpc('redeem_invite') directly (no store action) — thin route per D-03"
  - "navigate uses { replace: true } on success so back-button from /list/:code does not re-run the RPC"
  - "InvitePage placed outside AppShell in router (no sidebar during join flow) per Pitfall 6"

patterns-established:
  - "renderAtRoute helper pattern: MemoryRouter + Routes + stub routes for navigate targets (/list/:code, /) used in InvitePage tests"

requirements-completed:
  - SHARE-02

duration: 2min
completed: 2026-05-30
---

# Phase 10 Plan 03: InvitePage + Route Registration Summary

**InvitePage with redeem_invite RPC on mount, /list/:code redirect on success, invalid-invite fallback, and /invite/:code route wired into router.tsx outside AppShell**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-30T13:29:07Z
- **Completed:** 2026-05-30T13:30:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- InvitePage.tsx created: calls `supabase.rpc('redeem_invite', { p_share_code: code })` on mount, navigates to `/list/${data.share_code}` with `{ replace: true }` on success, shows "This invite link is invalid or has expired." on null/error
- All 5 InvitePage.test.tsx stubs converted from `it.todo` to passing tests (spinner, navigate-on-success, replace:true, null-data invalid state, error invalid state)
- `/invite/:code` registered in router.tsx as sibling to AppShell inside ProtectedRoute — unauthenticated users hit ProtectedRoute → returnTo stored → OAuth round-trip → LandingPage navigates back, no new auth code needed

## Task Commits

1. **Task 1: Create InvitePage.tsx and activate test stubs** - `d084d55` (feat)
2. **Task 2: Register /invite/:code route in router.tsx** - `28fceab` (feat)

## Files Created/Modified
- `src/pages/InvitePage.tsx` - Invite redemption page component
- `src/pages/InvitePage.test.tsx` - 5 passing unit tests (converted from it.todo stubs)
- `src/router.tsx` - Added InvitePage import + /invite/:code route inside ProtectedRoute, outside AppShell

## Decisions Made
None — followed plan as specified.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The full unit suite (`npx vitest run src/`) shows 1 failing test: `ShareBanner.test.tsx` line 51-53 asserts `/invite/ABC12345` in clipboard URL. This is a pre-existing Wave 0 RED test for the D-05 change (ShareBanner `/list/` → `/invite/` repoint) that belongs to plan 10-04. It was failing before this plan and is expected to remain red until 10-04 executes. Not a regression.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- InvitePage ready for end-to-end invite flow testing
- 10-04 can now implement ShareBanner D-05 repoint (activates the pre-existing RED ShareBanner test) and listsStore D-08 fetchLists filter drop
- The unauthenticated-partner OAuth flow (D-06) works via existing ProtectedRoute returnTo plumbing — no new code needed

---
*Phase: 10-list-sharing*
*Completed: 2026-05-30*
