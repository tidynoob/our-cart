---
phase: 03-shopping-flow
plan: "01"
subsystem: shopping-flow
tags: [checkbox, optimistic-update, gesture-isolation, tdd, store-action]
dependency_graph:
  requires: [02-list-management]
  provides: [toggleChecked-action, checkbox-component, checked-visual-state, gesture-isolation]
  affects: [ItemRow, CategorySection, ListPage, itemsStore]
tech_stack:
  added: []
  patterns:
    - Base UI Checkbox wrapper with data-[checked] presence attribute
    - Optimistic toggle with per-item rollback (follows updateItem pattern)
    - e.stopPropagation() gesture isolation for nested interactive elements
    - TDD red-green cycle for store action and component visual state
key_files:
  created:
    - src/components/ui/checkbox.tsx
    - src/stores/itemsStore.test.ts
    - src/components/ItemRow.test.tsx
  modified:
    - src/stores/itemsStore.ts
    - src/components/ItemRow.tsx
    - src/components/CategorySection.tsx
    - src/pages/ListPage.tsx
decisions:
  - "Checkbox wrapper uses outer div (h-[44px] w-[44px]) for tap target, not className on Root span, per RESEARCH Open Question 2 resolution"
  - "Gesture isolation via stopPropagation on checkbox wrapper div (both onClick and onKeyDown), per D-01 and Pitfall 1"
  - "ListPage Clear completed button and Dialog scaffold added (D-06, D-07) — clearChecked action wired in Plan 02"
  - "data-[checked] attribute used (Base UI), NOT data-[state='checked'] (Radix), per Pitfall 2"
metrics:
  duration: "6 minutes"
  completed: "2026-05-25"
  tasks: 2
  files: 7
---

# Phase 03 Plan 01: Checkbox Component + Toggle Action + Wiring Summary

## One-Liner

Base UI Checkbox wrapper with 44px tap target and data-[checked] styling, toggleChecked optimistic store action with per-item rollback, wired into ItemRow display mode with stopPropagation gesture isolation prop-drilled through CategorySection to ListPage.

## What Was Built

### Task 1: Checkbox wrapper + toggleChecked store action + unit tests

**TDD cycle completed:**

- RED: `src/stores/itemsStore.test.ts` written first — 3 tests failed (toggleChecked did not exist)
- GREEN: `src/components/ui/checkbox.tsx` created and `itemsStore.ts` extended — all 3 tests pass

**`src/components/ui/checkbox.tsx`** — New Base UI Checkbox wrapper:
- Outer `div` with `h-[44px] w-[44px]` enforces 44px mobile tap target (D-02)
- `CheckboxPrimitive.Root` renders the accessible checkbox with hidden `<input>`
- Inner `<span>` with `data-[checked]:bg-primary data-[checked]:border-primary` fills on check
- `CheckboxPrimitive.Indicator` renders Check icon inside when checked
- Named export `{ Checkbox }` — no default export (mirrors dialog.tsx convention)

**`src/stores/itemsStore.ts`** — Extended with `toggleChecked`:
- Interface: `toggleChecked: (id: string) => Promise<void>`
- Implementation follows updateItem pattern exactly: snapshot → optimistic set → Supabase UPDATE → rollback on error
- Does NOT include clearChecked (Plan 02 adds it per plan constraint)

**`src/stores/itemsStore.test.ts`** — 3 tests:
1. Optimistic update: checked=true before Supabase resolves
2. Rollback: checked restored to false + error set when Supabase errors
3. Both directions: false→true→false cycling

### Task 2: Wire checkbox into ItemRow, CategorySection, ListPage + ItemRow tests

**TDD cycle completed:**

- RED: `src/components/ItemRow.test.tsx` written first — 2 of 3 tests failed (onToggle and styling absent)
- GREEN: Production files modified — all 3 tests pass

**`src/components/ItemRow.tsx`** — Display mode modified:
- `onToggle: (id: string) => void` added to `ItemRowProps` interface
- Row outer div: `cn('...existing classes...', item.checked && 'opacity-50')` (D-05)
- Checkbox wrapper div inserted as first child with `onClick={e.stopPropagation()}` and `onKeyDown={e.stopPropagation()}` (D-01 gesture isolation)
- `<Checkbox>` wired with `checked={item.checked}`, `onCheckedChange={() => onToggle(item.id)}`, and `aria-label` with bought/not-bought copy (UI-SPEC copywriting contract)
- Name span: `cn('flex-1 text-base', item.checked && 'line-through')` (D-05)

**`src/components/CategorySection.tsx`** — `onToggle` prop added:
- Added to `CategorySectionProps` interface
- Destructured in function params
- Passed to `ItemRow` as `onToggle={() => onToggle(item.id)}`

**`src/pages/ListPage.tsx`** — Full toggle + clear scaffolding:
- `toggleChecked` subscribed from `useItemsStore`
- `checkedCount` derived reactively as `items.filter((i) => i.checked).length`
- `handleToggle(id)` handler added with `.catch(() => {})` guard
- `onToggle={handleToggle}` on each `<CategorySection>`
- "Clear completed (N)" Button rendered conditionally when `checkedCount > 0` (D-06)
- Clear confirmation Dialog with `disablePointerDismissal` scaffolded (D-07) — clearChecked action wired in Plan 02

**`src/components/ItemRow.test.tsx`** — 3 tests:
1. Checked visual state: opacity-50 on row, line-through on name
2. Unchecked visual state: no opacity-50, no line-through
3. stopPropagation: checkbox wrapper click does NOT call onTap; row body click DOES

## Test Results

```
Test Files: 9 passed
Tests:      44 passed (0 failed)
```

All tests green including 6 new tests (itemsStore.test.ts × 3, ItemRow.test.tsx × 3) and all 38 pre-existing tests.

## Deviations from Plan

### TDD Gate: RED and GREEN phases combined in one commit

**Found during:** Task 1 commit
**Issue:** The RED commit (`test(03-01)`) included checkbox.tsx and itemsStore.ts (the GREEN implementation) in the same commit because all three files were staged together. Strict TDD convention would have a `test(...)` commit with only the test file, then a `feat(...)` commit with implementation.
**Impact:** Functionally correct — tests were verified to fail before implementation existed in memory, and to pass after. The TDD process was followed correctly in execution; only the commit split was imperfect.
**Resolution:** Task 2 used separate staging (test file in RED conceptually, then implementation). Both test files were committed with the GREEN `feat(03-01)` commit.

### ListPage: clearChecked not wired in Clear Items button

**Rule 2 boundary respected:** The Clear Items button in the dialog correctly does NOT call clearChecked — that action is Plan 02's responsibility per the explicit plan constraint ("Do NOT add clearChecked here — that is Plan 02"). A `// clearChecked is Plan 02` comment was added. This is intentional, not a stub.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Clear Items onClick without clearChecked | src/pages/ListPage.tsx | ~235 | clearChecked action is Plan 02 — intentional boundary, documented in code |

## Threat Flags

None. All changes are within the existing trust boundary (client-side optimistic UI + Supabase UPDATE with existing RLS). No new endpoints or auth paths introduced.

## TDD Gate Compliance

- RED gate: Tests written first and verified to fail (itemsStore.test.ts × 3, ItemRow.test.tsx × 2 of 3)
- GREEN gate: Implementation written, all tests pass
- REFACTOR gate: No cleanup needed — implementation was clean on first pass

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/ui/checkbox.tsx exists | FOUND |
| src/stores/itemsStore.test.ts exists | FOUND |
| src/components/ItemRow.test.tsx exists | FOUND |
| src/stores/itemsStore.ts modified (toggleChecked) | FOUND |
| src/components/ItemRow.tsx modified (onToggle, checked styling) | FOUND |
| src/components/CategorySection.tsx modified (onToggle) | FOUND |
| src/pages/ListPage.tsx modified (handleToggle, Clear button/dialog) | FOUND |
| .planning/phases/03-shopping-flow/03-01-SUMMARY.md created | FOUND |
| Commit 8ad418d (test RED + implementation) exists | FOUND |
| Commit ee314b2 (feat GREEN wiring) exists | FOUND |
| STATE.md not modified by this agent | CONFIRMED |
| ROADMAP.md not modified by this agent | CONFIRMED |
| All 44 tests pass (npx vitest run) | CONFIRMED |
| TypeScript compiles clean (npx tsc --noEmit) | CONFIRMED |
