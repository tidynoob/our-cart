---
phase: 7
slug: lists-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.3 + @testing-library/react 16.3.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-W0-01 | 00 | 0 | LIST-01/02/03 | — | N/A | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ W0 | ⬜ pending |
| 7-create | — | 1 | LIST-01 | — | createList inserts owner_id = auth.uid(), share_code = nanoid(8); rolls back optimistic row on error | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ W0 | ⬜ pending |
| 7-fetch | — | 1 | LIST-01 | — | fetchLists selects where owner_id = (select auth.uid()) only | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ W0 | ⬜ pending |
| 7-rename | — | 1 | LIST-02 | — | renameList optimistic name update; rolls back to previous name on error | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ W0 | ⬜ pending |
| 7-delete | — | 1 | LIST-03 | — | deleteList removes row optimistically; rolls back (re-inserts) on error | unit | `npx vitest run src/stores/listsStore.test.ts` | ❌ W0 | ⬜ pending |
| 7-confirm | — | 2 | LIST-03 | — | Delete confirmation dialog renders "and all its items"; cancel leaves list intact (no delete called) | unit | `npx vitest run src/pages/LandingPage.test.tsx` | ✅ exists (update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/listsStore.test.ts` — stubs for LIST-01/02/03 (7 unit behaviors: create+rollback, fetch owner-scoped, rename+rollback, delete+rollback). Mirror `authStore.test.ts` mock pattern (`vi.hoisted()` + `vi.mock('@/lib/supabase')` + `useListsStore.setState({})` in `beforeEach`); chained builder mock for `from().insert().select().single()`.
- [ ] `src/pages/LandingPage.test.tsx` — update existing suite to add lists-home CRUD dialog behaviors (LIST-03 confirmation render + cancel-leaves-intact).

*No new framework install — Vitest already configured and green.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Created list appears as navigable destination at `/list/:code` | LIST-01 | Full router + auth round-trip in real browser | Sign in, create list "Groceries", confirm it appears in lists-home and clicking navigates to `/list/:code` |
| Renamed name reflected in ListPage header + lists-home in same session | LIST-02 | Cross-component optimistic propagation via store selector | Rename a list from lists-home, open it, confirm header shows new name without reload |
| Deleted current list navigates to `/` and URL becomes unreachable | LIST-03 | Router navigation + "List not found" fallback | Open a list, delete it from its page, confirm redirect to `/` and that revisiting the old `/list/:code` shows "List not found" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
