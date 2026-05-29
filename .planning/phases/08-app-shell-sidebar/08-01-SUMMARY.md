---
phase: 08-app-shell-sidebar
plan: "01"
subsystem: ui
tags: [react, react-router, zustand, base-ui, sidebar, layout-route]

requires:
  - phase: 08-00
    provides: AppShell.test.tsx, router.test.tsx, Sidebar.test.tsx failing stubs

provides:
  - SidebarContext.ts: React context exposing onOpenSidebar callback for ListPage trigger wiring
  - AppShell.tsx: pathless layout route with open useState, fetchLists guard, SidebarContext.Provider, Sidebar, Outlet
  - Sidebar.tsx: Base UI Dialog left-anchored drawer with list rows and aria-current active state
  - router.tsx: AppShell nested under ProtectedRoute, wrapping /list/:code

affects: [08-02, 09-auth-integration, ListPage hamburger wiring]

tech-stack:
  added: []
  patterns:
    - "SidebarContext pattern: thin createContext with callback, consumed by ListPage via useSidebarContext"
    - "fetchLists D-05 guard: useEffect([user]) with if (user && lists.length === 0) to prevent refetch on navigation"
    - "Base UI Dialog as left-anchored drawer: fixed inset-y-0 left-0, h-dvh, slide-in-from-left animation"

key-files:
  created:
    - src/contexts/SidebarContext.ts
    - src/components/AppShell.tsx
    - src/components/Sidebar.tsx
  modified:
    - src/router.tsx

key-decisions:
  - "Sidebar.tsx created in Plan 01 (not Plan 02) because AppShell.test.tsx requires role=dialog on trigger click — blocking issue Rule 3"
  - "AppShell renders Menu trigger button directly (not via SidebarContext prop-drill) — aligns with RESEARCH Pattern 2"
  - "Sidebar uses useMatch('/list/:code') for active row detection per RESEARCH Pitfall 3 guidance"

patterns-established:
  - "Pathless layout route pattern: element: <AppShell /> nested under element: <ProtectedRoute /> in createBrowserRouter"
  - "D-05 fetchLists guard: if (user && lists.length === 0) with single-dep [user] array"

requirements-completed: [NAV-01]

duration: 15min
completed: 2026-05-29
---

# Phase 08 Plan 01: AppShell Layout Component and Router Wiring Summary

**AppShell pathless layout route with SidebarContext, fetchLists D-05 guard, and Base UI left-anchored Sidebar drawer wired into react-router-dom under ProtectedRoute**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-29T09:10:00Z
- **Completed:** 2026-05-29T09:13:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- SidebarContext.ts created with `createContext` + `useSidebarContext` hook for prop-drilling-free trigger wiring
- AppShell.tsx implemented as pathless layout route: `open` useState (D-03), fetchLists useEffect guard (D-05), SidebarContext.Provider wrapping Sidebar + Outlet
- Sidebar.tsx implemented with Base UI Dialog primitive: left-anchored `fixed inset-y-0 left-0`, `h-dvh`, slide-in animation, list rows with `aria-current` active state
- router.tsx updated: AppShell inserted as pathless element route between ProtectedRoute and /list/:code
- All 4 AppShell.test.tsx stubs green; router.test.tsx 1/1 green; tsc clean

## Task Commits

1. **Task 1: Create SidebarContext, AppShell, and Sidebar** - `af0c4a7` (feat)
2. **Task 2: Wire AppShell into router.tsx** - `f772153` (feat)

## Files Created/Modified

- `src/contexts/SidebarContext.ts` - createContext with onOpenSidebar callback; useSidebarContext hook
- `src/components/AppShell.tsx` - pathless layout component; open useState; fetchLists guard; SidebarContext.Provider; Menu trigger button; Sidebar; Outlet
- `src/components/Sidebar.tsx` - Base UI DialogPrimitive.Root controlled open/onOpenChange; Portal/Backdrop/Popup; list rows with Link, aria-current, onClick close; useMatch for active detection
- `src/router.tsx` - added AppShell import; inserted pathless `element: <AppShell />` route between ProtectedRoute and /list/:code

## Decisions Made

- Sidebar.tsx created in Plan 01 (not deferred to Plan 02) because `AppShell.test.tsx` expects `getByRole('dialog')` after trigger click — without Sidebar.tsx, AppShell.tsx would fail TypeScript and the test would fail. Applied Rule 3 (blocking issue).
- AppShell renders the "Open navigation" Menu trigger button directly (not delegated via SidebarContext to ListPage) — this satisfies the test and keeps Plan 01 self-contained. Plan 02/03 can move the trigger into the ListPage header using SidebarContext if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created Sidebar.tsx in Plan 01 instead of deferring to Plan 02**
- **Found during:** Task 1 (Create SidebarContext and AppShell layout component)
- **Issue:** `AppShell.test.tsx` line 74 asserts `getByRole('dialog')` after clicking the "Open navigation" trigger. The plan action said to use a `div data-testid="sidebar-placeholder"`, but a plain `div` does not receive `role="dialog"`. Without a real Sidebar component, the test would fail and TypeScript would also fail on the `import Sidebar from '@/components/Sidebar'` line in AppShell.tsx.
- **Fix:** Created `src/components/Sidebar.tsx` using the Base UI Dialog primitive (the exact same approach specified for Plan 02), satisfying both AppShell.test.tsx and Sidebar.test.tsx (which was already scaffolded in Wave 0 and also needed a real Sidebar).
- **Files modified:** src/components/Sidebar.tsx (created)
- **Verification:** All 4 AppShell.test.tsx stubs green; all 4 Sidebar.test.tsx stubs green; tsc clean
- **Committed in:** af0c4a7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Sidebar.tsx was going to be built in Plan 02 anyway; creating it early unblocks AppShell.test.tsx and reduces Plan 02 scope to Sidebar refinements only. No scope creep — all work is on the critical path.

## Issues Encountered

Pre-existing test failures (not caused by this plan's changes — confirmed by running tests before stash pop):
- `src/components/NamePromptDialog.test.tsx` — 3 failures due to `localStorage` undefined in jsdom
- `src/pages/ListPage.test.tsx` — ~10 failures due to same `localStorage` issue

These are logged in `deferred-items.md`. Plan 01 changes did not introduce or worsen any test failures.

## Known Stubs

None — Sidebar.tsx renders real list data from props; all functionality is implemented.

## Next Phase Readiness

- AppShell layout host established; Plan 02 (Sidebar polish/hamburger placement in ListPage header) can proceed
- Sidebar.tsx already complete; Plan 02 may refine or wire the hamburger trigger into the ListPage header row via SidebarContext
- router.tsx structure correct: ProtectedRoute > AppShell > /list/:code

---
*Phase: 08-app-shell-sidebar*
*Completed: 2026-05-29*
