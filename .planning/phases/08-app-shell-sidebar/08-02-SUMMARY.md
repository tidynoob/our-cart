---
phase: 08-app-shell-sidebar
plan: "02"
subsystem: ui
tags: [react, react-router, base-ui, sidebar, focus-management, context]

requires:
  - phase: 08-01
    provides: Sidebar.tsx (incomplete), AppShell.tsx (floating button), SidebarContext.ts (no triggerRef)

provides:
  - Sidebar.tsx: complete drawer per UI-SPEC — finalFocus prop, Phase 9 profile slot, correct backdrop/border
  - AppShell.tsx: floating Menu button removed; finalFocus={triggerRef} wired; triggerRef in SidebarContext value
  - SidebarContext.ts: triggerRef added to context type and default value
  - ListPage.tsx: hamburger trigger Button (leading-left in header) wired via useSidebarContext()

affects: [08-03, 09-auth-integration, phase-9-profile-slot]

tech-stack:
  added: []
  patterns:
    - "triggerRef pattern: useRef<HTMLButtonElement> in AppShell, passed via SidebarContext, forwarded as finalFocus to Dialog.Popup for focus restoration on drawer close"
    - "Hamburger-in-context pattern: trigger rendered in ListPage header using useSidebarContext().triggerRef + onOpenSidebar — avoids fixed-position collision (Pitfall 2)"
    - "AppShell test mock child: MockListPageWithTrigger uses useSidebarContext to expose trigger button in tests — mirrors real ListPage architecture"

key-files:
  modified:
    - src/components/Sidebar.tsx
    - src/components/AppShell.tsx
    - src/components/AppShell.test.tsx
    - src/contexts/SidebarContext.ts
    - src/pages/ListPage.tsx

key-decisions:
  - "triggerRef threaded via SidebarContext so ListPage owns the DOM ref without prop drilling through router"
  - "AppShell test updated to use MockListPageWithTrigger (mirrors ListPage architecture) instead of plain div — keeps NAV-01b tests valid after trigger moved out of AppShell"
  - "Sidebar.tsx backdrop changed to bg-black/10 + supports-backdrop-filter:backdrop-blur-xs (UI-SPEC match); previous bg-black/40 was Plan 01 deviation"

metrics:
  duration: 5min
  completed: 2026-05-29
  tasks: 2
  files: 5
---

# Phase 08 Plan 02: Sidebar Refinements and Hamburger Trigger Wiring Summary

**Sidebar.tsx completed per UI-SPEC (finalFocus, profile slot, backdrop/border); hamburger trigger moved from floating AppShell button to ListPage header via SidebarContext triggerRef**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-05-29
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Sidebar.tsx: added `finalFocus` prop (Pitfall 6 focus restoration), Phase 9 profile slot (`data-slot="profile-slot"` with PROF-01/02/03 comment), fixed backdrop to `bg-black/10 supports-backdrop-filter:backdrop-blur-xs`, fixed header border to `border-b border-sidebar-border`
- SidebarContext.ts: added `triggerRef: React.RefObject<HTMLButtonElement>` to context type and default value
- AppShell.tsx: removed floating Menu Button and its imports; passes `finalFocus={triggerRef}` to Sidebar; includes `triggerRef` in contextValue useMemo
- ListPage.tsx: imports `Menu` + `useSidebarContext`; destructures `{ onOpenSidebar, triggerRef }` from context; hamburger Button (variant=ghost, size=icon, h-8 w-8, aria-label="Open navigation") prepended leading-left in header flex row
- AppShell.test.tsx: updated to use `MockListPageWithTrigger` child component that wires trigger via `useSidebarContext` — reflects real ListPage architecture; all 4 tests remain green

## Task Commits

1. **Task 1: Sidebar.tsx refinements** — `e07e0c1` (feat)
2. **Task 2: Wire hamburger trigger in ListPage; remove floating button from AppShell** — `e47656b` (feat)

## Files Modified

- `src/components/Sidebar.tsx` — finalFocus prop + Phase 9 slot + backdrop/border UI-SPEC corrections
- `src/contexts/SidebarContext.ts` — triggerRef added to context type and default
- `src/components/AppShell.tsx` — floating Button removed; triggerRef in contextValue; finalFocus passed to Sidebar
- `src/components/AppShell.test.tsx` — MockListPageWithTrigger replaces plain div child for NAV-01b tests
- `src/pages/ListPage.tsx` — Menu import, useSidebarContext hook, hamburger Button leading-left in header

## Decisions Made

- triggerRef threaded via SidebarContext so ListPage owns the DOM ref without prop drilling through router
- AppShell test updated to MockListPageWithTrigger to match real architecture after trigger moved out of AppShell
- Backdrop corrected from Plan 01's `bg-black/40` to UI-SPEC `bg-black/10 supports-backdrop-filter:backdrop-blur-xs`

## Deviations from Plan

### Adaptation to Plan 01 Deviation State

**1. [Rule 1 - Adaptation] Adapted plan to deviated on-disk state from Plan 01**
- **Found during:** Pre-execution review (CRITICAL_DEVIATION_BRIEFING)
- **Issue:** Plan 01 pre-created Sidebar.tsx (incomplete), AppShell.tsx with floating button, SidebarContext.ts without triggerRef — all different from the "create from scratch" assumption in 08-02-PLAN.md
- **Fix:** Targeted edits instead of recreation; adapted all changes to the existing files exactly as specified in the deviation briefing
- **Files modified:** All 5 files listed above
- **Committed in:** e07e0c1, e47656b

**2. [Rule 1 - Adaptation] AppShell.test.tsx updated to preserve test validity after architectural change**
- **Found during:** Task 2 (removing floating button from AppShell)
- **Issue:** AppShell tests NAV-01b ("renders Menu trigger button", "clicking trigger opens drawer") expected the button in AppShell's render output. After moving the trigger to ListPage, the mock `<div>List Content</div>` child no longer contained the button.
- **Fix:** Updated AppShell.test.tsx to use `MockListPageWithTrigger` — a test-only child component that wires the trigger via `useSidebarContext`, exactly mirroring the real ListPage pattern. All 4 AppShell tests remain green.
- **Files modified:** src/components/AppShell.test.tsx
- **Committed in:** e47656b

## Test Results

- `npx vitest run src/components/Sidebar.test.tsx` — 4/4 GREEN
- `npx vitest run src/components/AppShell.test.tsx` — 4/4 GREEN
- `npx vitest run src/router.test.tsx` — 1/1 GREEN
- `npx vitest run` — 13 pre-existing failures (NamePromptDialog.test.tsx 3, ListPage.test.tsx 10), 0 new failures introduced
- `npx tsc --noEmit` — exits 0

## Known Stubs

- Phase 9 profile slot (`data-slot="profile-slot"`) renders as an empty div — intentional, per UI-SPEC "DO NOT FILL". Wired in Phase 9 (PROF-01/02/03).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Sidebar remains read-only (no mutation calls). Context value carries no auth/data privileges per T-08-05 (accepted).

## Self-Check: PASSED

- src/components/Sidebar.tsx: exists with finalFocus prop, profile slot, correct backdrop
- src/contexts/SidebarContext.ts: triggerRef in type and default
- src/components/AppShell.tsx: floating Button removed, finalFocus wired, triggerRef in context
- src/pages/ListPage.tsx: hamburger trigger present leading-left
- Commits e07e0c1 and e47656b verified in git log
- 9/9 target tests green, 0 new failures
