---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [react, supabase, nanoid, zustand, react-router, tailwind, shadcn, vitest, web-share-api]

# Dependency graph
requires:
  - 01-02
provides:
  - extractShareCode utility (URL/path/raw-code input → 8-char share code)
  - CreateListForm (Supabase INSERT + nanoid(8) + navigate to /list/CODE)
  - JoinListForm (input validation with /^[A-Za-z0-9_-]{8}$/ + navigate)
  - LandingPage with two-section Create/Join layout (replaces stub)
  - ShareBanner (copy-to-clipboard + Web Share API + dismiss)
  - ListPage updated with ShareBanner integration via useUIStore
affects: [phase-2, phase-3, phase-4, phase-5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extractShareCode: utility function in src/lib/ — handles URL, path-style, and raw code inputs; never normalizes case (Pitfall 6)"
    - "nanoid(8) called inside async submit handler body — never at render or module scope (Pitfall 5)"
    - "CreateListForm error handling: renders string literal on Supabase error — never exposes error.message (T-03-02, V7)"
    - "JoinListForm validation: /^[A-Za-z0-9_-]{8}$/ applied to extracted code before navigate (T-03-03, V5)"
    - "ShareBanner Web Share API: feature-detected with typeof navigator !== 'undefined' && !!navigator.share; called directly in onClick handler (Pitfall 4)"
    - "ShareBanner dismiss: onDismiss prop wired to useUIStore dismissBanner action in ListPage"
    - "ListPage conditional: !dismissedBanners.has(list.share_code) guards ShareBanner render"

key-files:
  created:
    - "src/lib/extractShareCode.ts"
    - "src/components/CreateListForm.tsx"
    - "src/components/CreateListForm.test.tsx"
    - "src/components/JoinListForm.tsx"
    - "src/components/ShareBanner.tsx"
    - "src/components/ShareBanner.test.tsx"
  modified:
    - "src/pages/LandingPage.tsx"
    - "src/pages/ListPage.tsx"

key-decisions:
  - "Test regex /share/i matched aria-label='Dismiss share banner' — fixed test to use /^share$/i for exact button name matching (Rule 1 auto-fix)"
  - "ShareBanner accepts onDismiss as a prop rather than calling useUIStore internally — keeps the component pure/testable; ListPage wires the Zustand action"

# Metrics
duration: 3min
completed: 2026-05-25
---

# Phase 1 Plan 03: Create/Join/Share Walking Skeleton Summary

**Full Create → Share → Join flow: LandingPage with CreateListForm (Supabase INSERT + nanoid) and JoinListForm (code extraction + validation), ShareBanner with clipboard copy and Web Share API, ListPage updated with dismissable banner — 15 tests green, TypeScript build clean**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-25T02:50:15Z
- **Completed:** 2026-05-25T02:52:51Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 8 files (6 created, 2 modified)

## Accomplishments

- `src/lib/extractShareCode.ts`: utility that extracts a share code from any input format — full URL, path-only URL, or raw 8-char code. Case is never normalized (Pitfall 6).
- `src/components/CreateListForm.tsx`: controlled input form; validates non-empty name; generates `nanoid(8)` inside the async submit handler body (not render); inserts to Supabase `lists` table; navigates to `/list/${shareCode}` on success; renders `'Could not create list. Please try again.'` on error — never exposes raw Supabase error (T-03-02, V7).
- `src/components/JoinListForm.tsx`: calls `extractShareCode(input)`, validates with `/^[A-Za-z0-9_-]{8}$/` (T-03-03, V5), navigates to `/list/${extractedCode}` — does not query Supabase.
- `src/pages/LandingPage.tsx`: replaced stub with two-section layout (h1 "Our Cart", h2 "Create a list" + CreateListForm, h2 "Join a list" + JoinListForm), Tailwind centering.
- `src/components/ShareBanner.tsx`: renders share code in monospace, Copy link button with 2-second "Copied!" state, Share button conditionally rendered only when `!!navigator.share` (T-03-04), Dismiss button with `aria-label="Dismiss share banner"`. `navigator.share()` called directly in onClick (Pitfall 4).
- `src/pages/ListPage.tsx`: updated to import `useUIStore`, reads `dismissedBanners` and `dismissBanner`, conditionally renders `<ShareBanner>` when `!dismissedBanners.has(list.share_code)`.
- All test coverage: 15 tests green across 4 files (generateCode x3, ListPage x3, CreateListForm x4, ShareBanner x5).

## Task Commits

1. **Task 1: CreateListForm, JoinListForm, LandingPage (D-01, D-02, D-06)** - `561d8d7`
2. **Task 2: ShareBanner + ListPage integration (D-03, D-04)** - `ce941d7`

## Files Created/Modified

- `src/lib/extractShareCode.ts` — URL/path/raw-code → share_code extraction utility
- `src/components/CreateListForm.tsx` — Supabase INSERT form with nanoid share code generation
- `src/components/CreateListForm.test.tsx` — 4 tests: empty validation, insert call, navigate, error handling
- `src/components/JoinListForm.tsx` — Join form with extractShareCode + regex validation
- `src/components/ShareBanner.tsx` — Dismissable banner: copy + Web Share API + dismiss
- `src/components/ShareBanner.test.tsx` — 5 tests: code render, clipboard, dismiss, share-absent, share-present
- `src/pages/LandingPage.tsx` — Replaced stub with Create/Join two-section layout
- `src/pages/ListPage.tsx` — Added ShareBanner conditional render via useUIStore

## Decisions Made

- **Test regex specificity:** Initial test used `/share/i` to find the Share button, which also matched the Dismiss button's `aria-label="Dismiss share banner"`. Fixed to `/^share$/i` for exact button name matching (Rule 1 auto-fix during GREEN phase).
- **ShareBanner prop design:** `onDismiss` is a prop rather than an internal `useUIStore` call, keeping the component pure and independently testable. ListPage wires the actual Zustand action as the prop value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test regex /share/i matched Dismiss button aria-label**
- **Found during:** Task 2 (first GREEN test run)
- **Issue:** `screen.queryByRole('button', { name: /share/i })` matched both the "Share" button and the "Dismiss" button (whose `aria-label="Dismiss share banner"` contains "share"). The test for "Share button is absent" was returning non-null because the Dismiss button matched.
- **Fix:** Changed test regex from `/share/i` to `/^share$/i` for exact button name matching. Also corrected the "Share button is present" test from `/share/i` to `/^share$/i` for consistency.
- **Files modified:** `src/components/ShareBanner.test.tsx`
- **Commit:** Part of `ce941d7` (single-pass fix before final commit)

---

**Total deviations:** 1 auto-fixed (logic bug in test regex)
**Impact on plan:** Minimal — single test fix, no implementation changes needed.

## Threat Surface Scan

- **T-03-01 (XSS via list name):** Mitigated — `list.name` and `listName` rendered as JSX text interpolation in ListPage `<h1>` and ShareBanner `<span>` — no `dangerouslySetInnerHTML`.
- **T-03-02 (Supabase error exposed):** Mitigated — CreateListForm renders only `'Could not create list. Please try again.'` on error. Verified in CreateListForm.test.tsx test 4.
- **T-03-03 (Malformed share code):** Mitigated — JoinListForm validates with `/^[A-Za-z0-9_-]{8}$/` before calling `navigate`. Verified in JoinListForm implementation.
- **T-03-04 (Clipboard/Web Share without HTTPS/user gesture):** Mitigated — Copy button uses `navigator.clipboard.writeText` (HTTPS always true on Vercel); Share button guarded by `!!navigator.share` and called directly in onClick.

No new threat surface beyond what was planned.

## Phase 1 Completion

All three Walking Skeleton requirements are now satisfied:

- **SHARE-01:** User can create a new list (CreateListForm → Supabase INSERT → navigate to /list/CODE)
- **SHARE-02:** Partner opens shared link (JoinListForm or direct URL → ListPage loads by share_code)
- **SHARE-03:** Shared URL is the only credential (share_code in URL is the sole access token; no auth needed)

All decisions implemented: D-01 (two-path landing), D-02 (auto-detect join input), D-03 (copy + Web Share API), D-04 (dismissable banner), D-05 (/list/CODE URL), D-06 (8-char nanoid), D-07 (default alphabet).

---
*Phase: 01-foundation*
*Completed: 2026-05-25*

## Self-Check: PASSED

**Files verified:**
- `src/lib/extractShareCode.ts` — FOUND
- `src/components/CreateListForm.tsx` — FOUND
- `src/components/CreateListForm.test.tsx` — FOUND
- `src/components/JoinListForm.tsx` — FOUND
- `src/components/ShareBanner.tsx` — FOUND
- `src/components/ShareBanner.test.tsx` — FOUND
- `src/pages/LandingPage.tsx` — FOUND
- `src/pages/ListPage.tsx` — FOUND

**Commits verified:**
- `561d8d7` — FOUND (feat(01-03): CreateListForm, JoinListForm, LandingPage)
- `ce941d7` — FOUND (feat(01-03): ShareBanner component and ListPage integration)
