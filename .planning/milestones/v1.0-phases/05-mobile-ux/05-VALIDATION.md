---
phase: 05
slug: mobile-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | UX-01 | — | N/A | manual | visual inspection | — | ⬜ pending |
| TBD | TBD | TBD | UX-02 | — | N/A | manual | visual inspection | — | ⬜ pending |
| TBD | TBD | TBD | UX-03 | — | N/A | manual | visual inspection | — | ⬜ pending |
| TBD | TBD | TBD | LIST-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/AddItemBar.test.tsx` — stubs for LIST-05 autocomplete behavior
- [ ] Existing test infrastructure covers UX-01, UX-02, UX-03 (manual verification)

*Existing infrastructure covers framework and fixture needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phone-first layout, no horizontal scroll | UX-01 | Visual/responsive layout check | Open on mobile viewport (375px), verify no horizontal scroll, all elements visible |
| 44px tap targets on all interactive elements | UX-02 | Physical tap target measurement | Inspect Select triggers, "More details" toggle — verify min 44px computed height |
| Under 3 taps to add item | UX-03 | Interaction flow count | Open app → tap input (1) → type name → tap Add (2) = 2 taps |
| Autocomplete suggestions appear during entry | LIST-05 | Requires seeded data | Add items, then type prefix — verify dropdown shows matching suggestions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
