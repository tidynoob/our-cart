---
phase: 08-app-shell-sidebar
plan: "00"
subsystem: testing
tags: [vitest, testing-library, react, react-router-dom, zustand]

requires:
  - phase: 07-lists-infrastructure
    provides: listsStore, authStore, ProtectedRoute, router.tsx — all imported by new test stubs

provides:
  - Wave 0 test scaffolds for Phase 8 (AppShell + Sidebar)
  - 9 failing RED stubs covering NAV-01, NAV-02, D-01, D-08

affects:
  - 08-01 (Wave 1 implementation — stubs turn green when AppShell.tsx + Sidebar.tsx created)
  - 08-02 (Wave 2 router wiring — router.test.tsx stub turns green when router updated)

tech-stack:
  added: []
  patterns:
    - "vi.hoisted() + vi.mock(@/lib/supabase) merged auth+from shapes for component tests needing both store mocks"
    - "renderAtRoute helper nesting AppShell inside ProtectedRoute inside MemoryRouter to match actual router structure"
    - "vi.mock react-router-dom with importActual to preserve MemoryRouter/Routes/Route while overriding useMatch/useNavigate"

key-files:
  created:
    - src/components/AppShell.test.tsx
    - src/components/Sidebar.test.tsx
    - src/router.test.tsx
  modified: []

key-decisions:
  - "router.test.tsx asserts structural nesting via routes config inspection rather than full render, avoiding deep render complexity before AppShell exists"
  - "Sidebar.test.tsx uses vi.importActual for react-router-dom to preserve MemoryRouter while mocking useMatch/useNavigate hooks"

patterns-established:
  - "Component test file for layout wrapper: vi.hoisted supabase mock + useAuthStore.setState + useListsStore.setState in beforeEach"
  - "Router structure test: inspect router.routes[] array directly rather than render + waitFor navigation"

requirements-completed:
  - NAV-01
  - NAV-02

duration: 3min
completed: 2026-05-29
---

# Phase 8 Plan 00: Wave 0 Test Scaffolds Summary

**9 failing RED stubs across 3 test files covering AppShell open/fetchLists guards, Sidebar active-list highlight and navigation, and router nesting assertion**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-29T05:28:06Z
- **Completed:** 2026-05-29T05:30:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created AppShell.test.tsx with 4 stubs: menu trigger renders, trigger opens drawer, fetchLists called when empty, fetchLists NOT called when populated
- Created Sidebar.test.tsx with 4 stubs: lists render when open, active row has aria-current="page", active row has bg-sidebar-accent/font-semibold, click calls onOpenChange(false)
- Created router.test.tsx with 1 stub asserting AppShell is nested under ProtectedRoute at /list/:code

## Task Commits

1. **Task 1: Create AppShell.test.tsx with 4 failing stubs** - `1ae205c` (test)
2. **Task 2: Create Sidebar.test.tsx and router.test.tsx with failing stubs** - `ee43222` (test)

## Files Created/Modified

- `src/components/AppShell.test.tsx` - 4 RED stubs for NAV-01b/c/d behaviors; vi.hoisted merged auth+from supabase mock
- `src/components/Sidebar.test.tsx` - 4 RED stubs for NAV-01a, NAV-02a/b, D-08; mocks react-router-dom preserving actual MemoryRouter
- `src/router.test.tsx` - 1 RED stub for D-01; inspects router.routes config structure rather than rendering

## Decisions Made

- router.test.tsx inspects `router.routes[]` array directly (not a full render) to avoid needing real DOM navigation before AppShell.tsx exists. The assertion checks `router.routes[1].children[0].children[0].path === '/list/:code'` once the router is updated in Wave 1.
- Sidebar.test.tsx uses `vi.importActual('react-router-dom')` to preserve MemoryRouter/Routes/Route while only overriding `useMatch` and `useNavigate` — avoids mock breaking the render tree.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree was spawned at Phase 5 era commit (`6574c78`) with merge-base not matching expected `f41fa6d` (main HEAD). Applied the `<worktree_branch_check>` reset protocol to bring the worktree to correct base before creating files.
- Vitest config in main repo excludes `.claude/worktrees/**` — tests run correctly from worktree directory, not from the main repo root.

## Known Stubs

All 9 stubs in this plan are intentionally RED by design (Wave 0 scaffolding). They will turn green in Wave 1 (AppShell + Sidebar implementation) and Wave 2 (router nesting update). This is not a defect — it is the Nyquist test-first contract for Phase 8.

## Next Phase Readiness

- Wave 0 complete — all 3 test files exist with correct stubs
- Wave 1 (08-01) can now implement AppShell.tsx + Sidebar.tsx and run stubs to verify correctness
- Wave 2 (08-02) can update router.tsx and verify router.test.tsx turns green
- No blockers

---
*Phase: 08-app-shell-sidebar*
*Completed: 2026-05-29*
