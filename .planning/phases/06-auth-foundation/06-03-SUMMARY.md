---
phase: 06-auth-foundation
plan: 03
subsystem: auth-wiring
tags: [protectedroute, tdd, auth-initialization, route-protection, pkce]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [ProtectedRoute component, auth initialization in App.tsx, route protection for /list/:code, PKCE config]
  affects: [src/App.tsx, src/router.tsx, src/lib/supabase.ts]
tech_stack:
  added: []
  patterns: [Zustand selector per-value, useEffect cleanup return, React Router layout route, CSS-only spinner]
key_files:
  created:
    - src/components/auth/ProtectedRoute.tsx
  modified:
    - src/App.tsx
    - src/router.tsx
    - src/lib/supabase.ts
decisions:
  - "CSS-only spinner (animate-spin border-b-2) chosen over lucide-react Loader2 icon for simplicity"
  - "useEffect dependency array uses [initialize] not [] to avoid stale closure per plan spec"
metrics:
  duration: "3m"
  completed: "2026-05-28T15:01:10Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 06 Plan 03: ProtectedRoute TDD + Auth Wiring Summary

ProtectedRoute with isLoading spinner guard, sessionStorage returnTo, and Outlet render -- all 4 tests GREEN via TDD. App.tsx initializes authStore listener with cleanup, router.tsx wraps /list/:code in layout route, supabase.ts declares PKCE explicitly.

## Task Results

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | ProtectedRoute TDD (RED -> GREEN) | feat (tdd) | e619d26 | src/components/auth/ProtectedRoute.tsx |
| 2 | Wire auth into App.tsx, router.tsx, supabase.ts | feat | 807b953 | src/App.tsx, src/router.tsx, src/lib/supabase.ts |

## TDD Gate Compliance

- RED gate: Verified all 4 tests FAIL with "Failed to resolve import" (module not found) before implementation
- GREEN gate: All 4 tests PASS after ProtectedRoute.tsx created (commit e619d26)
- REFACTOR gate: Not needed -- implementation is minimal and clean (25 lines)

## What Was Built

### ProtectedRoute Component (src/components/auth/ProtectedRoute.tsx)
- Uses individual Zustand selectors: `useAuthStore((state) => state.user)` and `useAuthStore((state) => state.isLoading)`
- **isLoading guard**: Renders centered CSS spinner (`animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900`) when auth state is resolving. Prevents login flash (Pitfall 1 from RESEARCH.md).
- **Unauthenticated redirect**: Stores `location.pathname + location.search` in `sessionStorage('returnTo')` before redirecting to `/` with `replace={true}`. Survives OAuth browser redirect.
- **Authenticated path**: Renders `<Outlet />` for child route content.
- No async keywords anywhere (pure render component, per locked decision D-08).

### App.tsx Auth Initialization
- Added `useEffect` that calls `authStore.initialize()` on mount
- Returns cleanup function (subscription.unsubscribe) on unmount (T-06-07 mitigation)
- Dependency array: `[initialize]` -- stable reference from Zustand selector

### Router.tsx ProtectedRoute Wrapper
- `/list/:code` wrapped in pathless layout route: `{ element: <ProtectedRoute />, children: [...] }`
- Root route `/` and wildcard `*` remain unprotected (D-06)

### Supabase.ts Auth Config
- Added `auth: { flowType: 'pkce', detectSessionInUrl: true }` alongside existing `realtime: { worker: true }`
- PKCE is Supabase default; explicit for clarity (D-12)
- Existing realtime worker config preserved unchanged

## Verification Results

- `npx vitest run src/components/auth/ProtectedRoute.test.tsx`: 4/4 GREEN
- `npx vitest run src/stores/authStore.test.ts`: 9/9 GREEN
- `npx tsc --noEmit`: Exit 0 (no TypeScript errors)
- Full suite: 94 passing. 15 pre-existing failures in 3 files (NamePromptDialog localStorage issue, LandingPage RED scaffolds from Plan 01 awaiting Plan 04, ListPage localStorage/visibility issues) -- none related to this plan's changes.

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **CSS spinner over Loader2 icon**: Used `animate-spin border-b-2` Tailwind classes for the loading spinner rather than importing lucide-react's Loader2. Simpler, zero additional imports, matches PATTERNS.md Loading Spinner section.
2. **useEffect dependency**: Used `[initialize]` as specified in the plan (not empty `[]`) to avoid stale closure risk, even though Zustand's `create()` returns a stable reference.

## Known Stubs

None -- all implementations are complete and functional.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what was specified in the plan's threat model. ProtectedRoute is a UX guard only (T-06-06 accepted). useEffect cleanup prevents subscription leak (T-06-07 mitigated). sessionStorage returnTo is tab-scoped (T-06-08 accepted).

## Self-Check: PASSED

- src/components/auth/ProtectedRoute.tsx: FOUND
- src/App.tsx: FOUND
- src/router.tsx: FOUND
- src/lib/supabase.ts: FOUND
- 06-03-SUMMARY.md: FOUND
- Commit e619d26: FOUND
- Commit 807b953: FOUND
