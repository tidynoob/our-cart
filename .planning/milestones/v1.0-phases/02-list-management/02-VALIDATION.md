---
phase: 2
slug: list-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.3 + @testing-library/react 16.3.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | LIST-01 | — | N/A | unit | `npx vitest run src/stores/itemsStore.test.ts -t "addItem"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | LIST-01 | — | N/A | unit | `npx vitest run src/components/AddItemBar.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | LIST-02 | — | N/A | unit | `npx vitest run src/stores/itemsStore.test.ts -t "updateItem"` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | LIST-02 | — | N/A | unit | `npx vitest run src/components/ItemRow.test.tsx -t "edit"` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | LIST-03 | T-2-03 | RLS DELETE scoped by list_id | unit | `npx vitest run src/stores/itemsStore.test.ts -t "deleteItem"` | ❌ W0 | ⬜ pending |
| 2-01-06 | 01 | 1 | LIST-04 | — | N/A | unit | `npx vitest run src/lib/attribution.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-07 | 01 | 1 | LIST-04 | — | N/A | unit | `npx vitest run src/components/NamePromptDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-08 | 01 | 1 | LIST-06 | — | N/A | unit | `npx vitest run src/lib/categories.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/itemsStore.test.ts` — stubs for LIST-01, LIST-02, LIST-03 (store actions)
- [ ] `src/components/AddItemBar.test.tsx` — covers LIST-01 (form submission)
- [ ] `src/components/ItemRow.test.tsx` — covers LIST-02 (edit mode toggle)
- [ ] `src/lib/categories.test.ts` — covers LIST-06 (grouping + ordering)
- [ ] `src/lib/attribution.test.ts` — covers LIST-04 (color hash + initials)
- [ ] `src/components/NamePromptDialog.test.tsx` ��� covers LIST-04 (localStorage detection)
- [ ] shadcn Dialog + Select installed: `npx shadcn@latest add dialog select`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Name prompt blocks list interaction until submitted | LIST-04 | Dialog modality requires browser testing | Open list in incognito → verify dialog blocks all interaction → enter name → verify badge appears |
| Category dropdown uses native picker on mobile | LIST-06 | Device-dependent behavior | Open on iOS Safari → verify OS picker appears for category select |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
