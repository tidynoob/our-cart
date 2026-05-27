---
phase: 01-foundation
plan: 02
subsystem: routing
tags: [react-router, zustand, supabase, vitest, testing, routing, ui-state]

# Dependency graph
requires:
  - 01-01
provides:
  - React Router v7 SPA shell with three routes: /, /list/:code, *
  - Zustand useUIStore with dismissedBanners Set<string> and dismissBanner action
  - ListPage querying Supabase by share_code (raw, no normalization)
  - NotFoundPage with Link back to /
  - LandingPage stub (Plan 03 replaces)
  - Unit tests: generateCode.test.ts (SHARE-01), ListPage.test.tsx (SHARE-02, SHARE-03)
affects: [01-03, phase-2, phase-3, phase-4, phase-5]

# Tech tracking
tech-stack:
  added:
    - "react-router-dom@7.15.1 createBrowserRouter + RouterProvider"
    - "zustand@5.0.13 create<T>() double-parentheses TypeScript pattern"
  patterns:
    - "Router: createBrowserRouter([...]) in src/router.tsx, RouterProvider in App.tsx"
    - "Zustand v5: create<UIState>()((set) => ({ ... })) double-parentheses form for TS inference"
    - "Supabase query in ListPage: .eq('share_code', code) with raw useParams() value — no .toLowerCase()"
    - "Generic error surface: ListPage renders 'List not found' string on any Supabase error (T-02-01)"
    - "vitest exclude: .claude/worktrees/** excluded from main project vitest discovery"

key-files:
  created:
    - "src/stores/uiStore.ts"
    - "src/router.tsx"
    - "src/pages/LandingPage.tsx"
    - "src/pages/ListPage.tsx"
    - "src/pages/NotFoundPage.tsx"
    - "src/pages/ListPage.test.tsx"
  modified:
    - "src/App.tsx"
    - "vitest.config.ts"

key-decisions:
  - "Added vitest exclude for .claude/worktrees/ to prevent main project vitest from scanning worktree test files that resolve @-alias against wrong src root (Rule 3 auto-fix)"
  - "ListPage renders dismissedBanners.has(share_code) via data attribute to make share_code available for Plan 03 ShareBanner without introducing premature state logic"
  - "Test assertion for no-case-normalization uses .toLowerCase() comparison not .toUpperCase() (ABC12345 is already uppercase so .toUpperCase() produces same value — logic error in original test draft)"

# Metrics
duration: 3min
completed: 2026-05-25
---

# Phase 1 Plan 02: App Shell Routing and ListPage Summary

**React Router v7 SPA shell with three routes, Zustand dismissedBanners store, real ListPage querying Supabase by raw share_code, and 6 unit tests green for SHARE-01/02/03 error handling**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-25T02:43:35Z
- **Completed:** 2026-05-25T02:46:46Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 8 files (6 created, 2 modified)

## Accomplishments

- Zustand v5 `useUIStore` with `dismissedBanners: Set<string>` and `dismissBanner` action using double-parentheses TypeScript pattern
- `createBrowserRouter` with all three routes: `/`, `/list/:code`, `*`
- `App.tsx` replaced with `RouterProvider` wrapper (Plan 01 `<div>Our Cart</div>` placeholder removed)
- `NotFoundPage.tsx` with `Link` back to `/` and Tailwind centering
- `LandingPage.tsx` stub (Plan 03 replaces with Create/Join forms)
- `ListPage.tsx`: full implementation — `useParams(:code)`, Supabase `.eq('share_code', code)` with raw code (no normalization), generic `'List not found'` on error (T-02-01 mitigation), `useUIStore` wired for Plan 03's ShareBanner
- `ListPage.test.tsx`: 3 tests — renders list name, shows generic error, `.eq` called with exact code
- `generateCode.test.ts` already complete from Plan 01 (3 tests: length, alphabet, uniqueness)
- `vitest.config.ts`: added exclude for `.claude/worktrees/**` to prevent test discovery conflicts

## Task Commits

1. **Task 1: Zustand UI store, React Router, App shell** - `2256119`
2. **Task 2: Real ListPage + unit tests** - `5ec5ecd`
3. **Fix: vitest config exclude** - `7ed8f0a`

## Files Created/Modified

- `src/stores/uiStore.ts` — Zustand UIState interface, useUIStore export, dismissedBanners Set, dismissBanner action
- `src/router.tsx` — createBrowserRouter with /, /list/:code, * routes
- `src/App.tsx` — RouterProvider wrapper (replaces Plan 01 placeholder)
- `src/pages/LandingPage.tsx` — stub (Plan 03 replacement)
- `src/pages/ListPage.tsx` — real impl: useParams, supabase query, loading/error/success states
- `src/pages/NotFoundPage.tsx` — 404 page with Link to /
- `src/pages/ListPage.test.tsx` — 3 vitest tests for SHARE-02 and T-02-01 error handling
- `vitest.config.ts` — added exclude: ['**/node_modules/**', '**/.claude/worktrees/**']

## Decisions Made

- **vitest exclude:** The main project's `vitest.config.ts` has no `include` scope guard; running vitest from the main project root picks up test files in `.claude/worktrees/` where the `@` alias resolves to the wrong `src/` directory. Added exclude pattern to prevent false failures. (Rule 3 auto-fix)
- **dismissedBanners data attribute:** ListPage exposes `list.share_code` and `dismissedBanners.has()` via a `data-*` div rather than a premature component. Plan 03 will replace this with the actual ShareBanner component and `useUIStore` call inline.
- **Test assertion correction:** The original draft test for "no case normalization" included `expect(mockEq).not.toHaveBeenCalledWith('share_code', 'ABC12345'.toUpperCase())` — but `'ABC12345'.toUpperCase() === 'ABC12345'`, which was the actual argument, making the assertion always fail. Corrected to `.toLowerCase()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vitest test discovery conflict between main project and worktree**
- **Found during:** Task 2 (test verification)
- **Issue:** `npx vitest run` from the main project root discovered test files in `.claude/worktrees/agent-*/src/pages/` because the main vitest.config.ts has no `include` scope guard. The worktree's `ListPage.test.tsx` imported `@/stores/uiStore` but vitest resolved `@` to the main project's `src/` (not the worktree's), causing `Failed to resolve import "@/stores/uiStore"`.
- **Fix:** Added `exclude: ['**/node_modules/**', '**/.claude/worktrees/**']` to `vitest.config.ts`. Tests now run cleanly from both the main project (3 tests) and the worktree (6 tests).
- **Files modified:** `vitest.config.ts`
- **Commit:** `7ed8f0a`

**2. [Rule 1 - Bug] Corrected test assertion for case normalization check**
- **Found during:** Task 2 (first vitest run)
- **Issue:** Test 3 in `ListPage.test.tsx` used `'ABC12345'.toUpperCase()` to assert the mock wasn't called with a normalized version. Since `'ABC12345'` is already uppercase, `.toUpperCase()` returns the same string — causing `expect(mockEq).not.toHaveBeenCalledWith('share_code', 'ABC12345')` to fail (mockEq was called with exactly that value).
- **Fix:** Changed `.toUpperCase()` to `.toLowerCase()` — the correct assertion that confirms no lowercase normalization occurred.
- **Files modified:** `src/pages/ListPage.test.tsx`
- **Commit:** Part of `5ec5ecd` (single-pass fix before final commit)

---

**Total deviations:** 2 auto-fixed (1 blocking config, 1 logic bug in test)
**Impact on plan:** Both fixes required for tests to pass. No scope creep.

## Threat Surface Scan

T-02-01 (Supabase error in UI): Mitigated — `ListPage` renders only `'List not found'` string on error, never `error.message` or any Supabase error detail. Verified in `ListPage.test.tsx` test 2.

T-02-03 (XSS via list name): Mitigated — `list.name` rendered as `<h1>` text via JSX interpolation (no `dangerouslySetInnerHTML`). React escapes all interpolated values.

No new threat surface introduced beyond what was planned.

## Next Phase Readiness

- All routes navigable: `/` → LandingPage stub, `/list/:code` → real ListPage, `*` → NotFoundPage
- ListPage fetches by share_code and handles loading/error/success states correctly
- Zustand store ready for Plan 03's ShareBanner to call `dismissBanner(list.share_code)`
- All 6 tests green: 3 generateCode (SHARE-01) + 3 ListPage (SHARE-02, SHARE-03)
- TypeScript build clean, no errors
- Plan 03 (LandingPage Create/Join UI) has all prerequisites met

---
*Phase: 01-foundation*
*Completed: 2026-05-25*

## Self-Check: PASSED

**Files verified:**
- `src/stores/uiStore.ts` — FOUND
- `src/router.tsx` — FOUND
- `src/App.tsx` — FOUND (contains RouterProvider)
- `src/pages/LandingPage.tsx` — FOUND
- `src/pages/ListPage.tsx` — FOUND
- `src/pages/NotFoundPage.tsx` — FOUND
- `src/pages/ListPage.test.tsx` — FOUND
- `vitest.config.ts` — FOUND

**Commits verified:**
- `2256119` — feat(01-02): add Zustand UI store, React Router, and App shell
- `5ec5ecd` — feat(01-02): real ListPage with Supabase query and unit tests for SHARE-01/02
- `7ed8f0a` — fix(01-02): exclude worktree dirs from vitest discovery in main project config
