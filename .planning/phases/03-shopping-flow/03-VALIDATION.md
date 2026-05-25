---
phase: 3
slug: shopping-flow
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
validated: 2026-05-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom + @testing-library/react) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/stores/itemsStore.test.ts src/components/ItemRow.test.tsx src/pages/ListPage.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds (phase files); ~3s full suite |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SHOP-01, SHOP-02 | T-03-01 | toggleChecked UPDATE scoped by list_id via Phase 2 RLS | unit | `npx vitest run src/stores/itemsStore.test.ts` | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | SHOP-01, SHOP-02 | — | Gesture isolation (stopPropagation) prevents edit-mode trigger | unit | `npx vitest run src/components/ItemRow.test.tsx` | ✅ | ✅ green |
| 03-02-01 | 02 | 2 | SHOP-03 | T-03-04 / T-03-05 | clearChecked DELETE scoped by list_id + checked=true via RLS; listId never user-supplied | unit | `npx vitest run src/stores/itemsStore.test.ts` | ✅ | ✅ green |
| 03-02-02 | 02 | 2 | SHOP-03, SHOP-04 | — | Modal confirmation gate; disablePointerDismissal blocks accidental clear | integration | `npx vitest run src/pages/ListPage.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Test counts:** itemsStore.test.ts (6: 3 toggle + 3 clear), ItemRow.test.tsx (3), ListPage.test.tsx (8). Phase total: 17 automated, all green.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. vitest + @testing-library/react were established in prior phases; no new framework or fixtures needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-device check-off (44px tap-target feel, touch routing, CSS render) | SHOP-01 | Touch dispatch + rendered appearance not exercisable in jsdom | On mobile browser: tap checkbox → fills, name line-through, row ~50% opacity, edit form does NOT open |
| Real-device gesture isolation (row body vs checkbox) | SHOP-01, D-01 | iOS Safari / Android Chrome pointer-event routing differs from synthetic events | Tap row body → edit form opens; tap checkbox area → edit does NOT open |
| Backdrop dismissal blocked on mobile | SHOP-04, D-07 | disablePointerDismissal touch-swallow not exercised by integration tests | Open Clear dialog, tap backdrop → dialog stays open |
| No accidental real-time coupling | — (Phase 4 scope) | Requires two live sessions vs real Supabase | Open list in 2 tabs, check item in one → second tab does NOT update live |

*Tracked in `03-VERIFICATION.md` (human UAT, status: pending real-device run). In-browser UAT (`03-UAT.md`) passed 9/9, including desktop equivalents of all four items.*

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra)
- [x] No watch-mode flags
- [x] Feedback latency < 3s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-25

---

## Validation Audit 2026-05-25
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All four requirements (SHOP-01–04) have green automated coverage. VALIDATION.md was an unfilled template prior to this audit; reconstructed from 03-01/03-02 SUMMARY artifacts and live test run (17 passed). Real-device behaviors recorded as Manual-Only, tracked in 03-VERIFICATION.md.
