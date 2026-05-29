---
phase: 8
slug: app-shell-sidebar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.2.3 + Testing Library ^16.3.0 (jsdom) |
| **Config file** | `vitest.config.ts` (root) — already present |
| **Quick run command** | `npx vitest run src/components/AppShell.test.tsx src/components/Sidebar.test.tsx --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick command (AppShell + Sidebar specs)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-W0 | 00 | 0 | NAV-01/02, D-01/08 | — | N/A | scaffold | `npx vitest run src/components/AppShell.test.tsx src/components/Sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 08-NAV-01a | TBD | 1+ | NAV-01 | — | Sidebar shows only owner's lists (listsStore owner-scoped) | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-NAV-01b | TBD | 1+ | NAV-01 | — | Menu trigger opens drawer; lists render | unit | `npx vitest run src/components/AppShell.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-NAV-01c | TBD | 1+ | NAV-01 | — | fetchLists called on mount when lists empty | unit | `npx vitest run src/components/AppShell.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-NAV-01d | TBD | 1+ | NAV-01 | — | fetchLists NOT called when lists already populated | unit | `npx vitest run src/components/AppShell.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-NAV-02a | TBD | 1+ | NAV-02 | — | Active list row has `aria-current="page"` | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-NAV-02b | TBD | 1+ | NAV-02 | — | Active list row has visual-distinct class (e.g. bg-accent) | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-D08 | TBD | 1+ | NAV-01 / D-08 | — | Clicking a list row navigates + closes sidebar | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-D01 | TBD | 1+ | D-01 | — | AppShell nested under ProtectedRoute in router tree | unit | `npx vitest run src/router.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Active-list match uses `useMatch('/list/:code')` inside Sidebar (NOT `useParams()` — AppShell is the parent route, so `useParams()` returns `{}` there). See RESEARCH §Pitfall.*

---

## Wave 0 Requirements

- [ ] `src/components/AppShell.test.tsx` — stubs for NAV-01 (open trigger, fetchLists-when-empty guard, no-refetch-when-populated)
- [ ] `src/components/Sidebar.test.tsx` — stubs for NAV-01 (list rendering), NAV-02 (active highlight + aria-current), D-08 (navigate+close on tap)
- [ ] `src/router.test.tsx` — stub for D-01 (AppShell nested under ProtectedRoute); check whether a router test already exists before creating
- Framework already installed — no install task needed.

*Pattern to follow: `src/stores/listsStore.test.ts` (mock Supabase via `vi.mock`), `src/components/auth/ProtectedRoute.test.tsx` (mock router + store). Base UI Dialog portals into `document.body` — query portaled drawer via `getByRole('dialog')` / within `document.body`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slide-in animation renders smoothly | NAV-01 | jsdom has no layout/animation engine; `tw-animate-css` transforms aren't observable in unit tests | In `npm run dev`, open a list, tap the Menu trigger; drawer should slide in from the left, ~200ms |
| No layout breakage mobile + desktop | Success criterion 4 | Visual/responsive — not assertable in jsdom | Open the drawer at 375px (mobile) and ≥1280px (desktop); drawer is width-constrained (~w-72/max 80vw), content not pushed/broken, backdrop covers viewport |
| Focus trap + Escape + focus restore | NAV-01 (a11y) | jsdom focus semantics are unreliable for portal focus trapping | Open drawer → Tab cycles within drawer; Escape closes; focus returns to the Menu trigger |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
