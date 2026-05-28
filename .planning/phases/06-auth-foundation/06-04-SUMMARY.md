---
phase: 06-auth-foundation
plan: 04
subsystem: auth-ui
tags: [auth, landing-page, login, google-oauth, conditional-render]
dependency_graph:
  requires: [06-02, 06-03]
  provides: [LoginPage-component, auth-conditional-LandingPage, return-to-URL]
  affects: [src/pages/LandingPage.tsx, src/components/auth/LoginPage.tsx]
tech_stack:
  added: []
  patterns: [zustand-selector, auth-conditional-render, sessionStorage-returnTo, loading-spinner]
key_files:
  created:
    - src/components/auth/LoginPage.tsx
    - src/components/auth/LoginPage.test.tsx
  modified:
    - src/pages/LandingPage.tsx
decisions:
  - "LoginPage is a pure presentational component with no internal state or hooks"
  - "Error display uses text-destructive class below the sign-in button for OAuth failure recovery"
  - "Return-to-URL clears sessionStorage after navigation to prevent stale redirects"
  - "Loading spinner uses same animate-spin pattern as ProtectedRoute for visual consistency"
metrics:
  duration: "3m 23s"
  completed: 2026-05-28
  tasks_completed: 2
  tasks_total: 2
  test_count: 9
  test_pass: 9
---

# Phase 06 Plan 04: LandingPage + LoginPage Auth UI Summary

LoginPage component with Google sign-in button and LandingPage auth-conditional rendering with return-to-URL after OAuth redirect.

## What Was Built

### Task 1: LoginPage Component (TDD)
- Created `src/components/auth/LoginPage.tsx` -- pure presentational component
- Renders "Our Cart" heading, "Your shared grocery list" subtitle, and "Sign in with Google" button
- Props: `onSignIn: () => Promise<void>` and optional `error?: string | null`
- Error display shows below the button with `text-destructive` styling for OAuth failure recovery
- Uses `Button` from `@/components/ui/button` with `size="lg"`
- No internal state (useState/useEffect) -- all auth state comes from parent via props
- 6 unit tests covering heading, subtitle, button, click handler, error display, and no-error cases

### Task 2: LandingPage Auth-Conditional Rendering (TDD)
- Transformed `src/pages/LandingPage.tsx` with three rendering states:
  - **Loading** (`isLoading: true`): Full-screen centered spinner with `animate-spin`
  - **Unauthenticated** (`user: null`): Renders `LoginPage` component with `signInWithGoogle` and `error` props
  - **Authenticated** (`user` set): Original create/join list forms (preserved exactly)
- Implemented return-to-URL behavior (D-04): `useEffect` reads `sessionStorage('returnTo')`, navigates with `replace: true`, then clears storage
- Uses individual Zustand selectors per PATTERNS.md (one `useAuthStore` call per value)
- 3 auth-conditional tests from Plan 01 now pass GREEN

## TDD Gate Compliance

- RED: `c9173c1` -- `test(06-04): add failing tests for LoginPage component` (6 tests fail, LoginPage doesn't exist)
- GREEN: `7dca19e` -- `feat(06-04): implement LoginPage component with Google sign-in button` (6 tests pass)
- RED: Plan 01 tests already existed in `LandingPage.test.tsx` (2 of 3 auth tests failed before implementation)
- GREEN: `e99b721` -- `feat(06-04): transform LandingPage with auth-conditional rendering` (3 tests pass)

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| LoginPage.test.tsx | 6 | All pass |
| LandingPage.test.tsx (auth-conditional) | 3 | All pass |
| Full suite | 102 pass, 13 pre-existing failures | No regressions |

Pre-existing failures are in `NamePromptDialog.test.tsx` and `ListPage.test.tsx` (localStorage undefined in test env, offline/online event handlers) -- unrelated to auth changes.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `c9173c1` | test | Add failing tests for LoginPage component (RED) |
| `7dca19e` | feat | Implement LoginPage component with Google sign-in button (GREEN) |
| `e99b721` | feat | Transform LandingPage with auth-conditional rendering (GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed toHaveTextContent assertion in LoginPage test**
- **Found during:** Task 1 RED phase
- **Issue:** Test used `toHaveTextContent` which requires jest-dom matchers not configured in this project
- **Fix:** Changed to `heading.textContent` comparison using standard Vitest `toBe` matcher
- **Files modified:** src/components/auth/LoginPage.test.tsx
- **Commit:** 7dca19e (included in GREEN commit)

## Verification

- `npx vitest run src/pages/LandingPage.test.tsx` -- 3/3 tests GREEN
- `npx vitest run src/components/auth/LoginPage.test.tsx` -- 6/6 tests GREEN
- `npx tsc --noEmit` -- exits 0 (no TypeScript errors)
- Full suite: 102 tests pass, 0 regressions introduced

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.
