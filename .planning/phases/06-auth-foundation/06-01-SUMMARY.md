---
phase: 06-auth-foundation
plan: 01
subsystem: auth
tags: [oauth, testing, wave-0, tdd-red]
dependency_graph:
  requires: []
  provides: [authStore.test.ts, ProtectedRoute.test.tsx, LandingPage-auth-tests]
  affects: [06-02, 06-03, 06-04]
tech_stack:
  added: []
  patterns: [vi.hoisted-mock-capture, MemoryRouter-layout-route, zustand-setState-injection]
key_files:
  created:
    - src/stores/authStore.test.ts
    - src/components/auth/ProtectedRoute.test.tsx
    - src/pages/LandingPage.test.tsx
  modified: []
decisions:
  - "Used vi.hoisted callback capture pattern from itemsStore.test.ts for onAuthStateChange mock"
  - "Used MemoryRouter layout route pattern from ListPage.test.tsx for ProtectedRoute test helper"
  - "Created LandingPage.test.tsx as new file (no existing test file to append to)"
metrics:
  duration: 113s
  completed: 2026-05-27
---

# Phase 06 Plan 01: OAuth Config + Wave 0 Test Scaffolds Summary

Wave 0 RED test scaffolds for Google OAuth auth foundation with vi.hoisted callback capture pattern for onAuthStateChange mock and MemoryRouter layout route testing for ProtectedRoute

## Task Results

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Configure Google OAuth in Supabase + Google Cloud Console | checkpoint:human-action | N/A (manual) | Dashboard config only |
| 2 | Create Wave 0 test scaffolds for authStore, ProtectedRoute, and LandingPage | auto (tdd) | 610d5de | src/stores/authStore.test.ts, src/components/auth/ProtectedRoute.test.tsx, src/pages/LandingPage.test.tsx |

## What Was Built

### Task 1: OAuth Provider Configuration (Human Action)
User configured Google OAuth in three locations:
- Supabase Dashboard: Google OAuth provider enabled with Client ID + Secret
- Supabase Dashboard: Site URL set to http://localhost:5173, redirect URL allowlist includes http://localhost:5173/**
- Google Cloud Console: OAuth 2.0 Client ID with Supabase callback URI as authorized redirect

### Task 2: Wave 0 Test Scaffolds (16 behaviors total)

**authStore.test.ts (9 behaviors):**
- initialize() calls supabase.auth.onAuthStateChange exactly once
- initialize() sets user and session from INITIAL_SESSION event callback
- initialize() sets isLoading: false after callback fires
- initialize() sets isLoading: false when callback receives null session
- initialize() calls supabase.realtime.setAuth(token) with session access_token
- initialize() calls supabase.realtime.setAuth(null) when session is null
- initialize() returns cleanup function that calls subscription.unsubscribe()
- signInWithGoogle() calls supabase.auth.signInWithOAuth with provider: 'google'
- signInWithGoogle() sets error state when signInWithOAuth returns an error

**ProtectedRoute.test.tsx (4 behaviors):**
- Renders loading spinner (animate-spin) when isLoading: true
- Redirects to "/" when isLoading: false and user: null
- Stores location.pathname in sessionStorage('returnTo') before redirecting
- Renders Outlet content when isLoading: false and user is populated

**LandingPage.test.tsx (3 behaviors):**
- Renders "Sign in with Google" button when user: null and isLoading: false
- Renders "Create a list" heading when user is populated and isLoading: false
- Renders loading spinner (animate-spin) when isLoading: true

All 16 tests are RED -- implementations (authStore.ts, ProtectedRoute.tsx) do not exist yet. Plans 02 and 03 will make them GREEN.

## Test Suite Integrity

- Existing tests: 80 passing, 13 failing (pre-existing failures in ListPage.test.tsx and NamePromptDialog.test.tsx)
- New test files: 3 files with import errors (expected -- modules not yet created)
- No regression introduced

## Deviations from Plan

### Minor Adjustments

**1. [Rule 3 - Blocking] LandingPage.test.tsx created as new file instead of appended**
- **Found during:** Task 2
- **Issue:** Plan says "Append a new describe block" to existing LandingPage.test.tsx, but no LandingPage.test.tsx existed in the codebase
- **Fix:** Created the file from scratch with the three required auth-conditional rendering tests
- **Files created:** src/pages/LandingPage.test.tsx

**2. [Clarification] Supabase mock in LandingPage.test.tsx includes from() namespace**
- **Found during:** Task 2
- **Issue:** LandingPage imports CreateListForm and JoinListForm which use supabase.from() -- the mock needed the from() namespace in addition to auth/realtime to avoid import-time errors once authStore exists
- **Fix:** Added minimal from() mock chain alongside auth and realtime mocks

## Known Stubs

None -- these are test scaffolds only, no implementation stubs.

## Self-Check: PASSED

- [x] src/stores/authStore.test.ts exists
- [x] src/components/auth/ProtectedRoute.test.tsx exists
- [x] src/pages/LandingPage.test.tsx exists
- [x] Commit 610d5de exists in git log
- [x] 06-01-SUMMARY.md exists
