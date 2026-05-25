---
phase: 2
reviewers: [codex]
reviewed_at: 2026-05-25T12:00:00Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 2

## Codex Review

### Summary

The plans are broadly coherent and cover the Phase 2 user-facing goals: add, view, edit, delete, attribution, and category grouping. The main risks are around data/security semantics in the foundation plan, category/null handling, inline edit blur behavior on mobile, and a few missing operational details like initial item loading, error display, and optimistic rollback safety. Overall this is a solid phase plan, but it needs tighter contracts before implementation.

### Plan 02-01: Foundation Layer

**Strengths**
- Puts schema, shared types, utilities, and store behavior before UI work.
- Optimistic CRUD is appropriate for a lightweight real-time grocery app.
- Tests for category and attribution utilities are a good low-cost guardrail.
- Recognizes that UPDATE/DELETE RLS must be added before edit/delete UI ships.

**Concerns**
- **HIGH:** RLS policy details are underspecified. UPDATE needs both `USING` and `WITH CHECK`; otherwise list ownership/access invariants can be weakened.
- **HIGH:** If existing access control is only "row belongs to an existing list," anon clients may be able to update/delete any guessed list item. The plan should explicitly match Phase 1's sharing/security model.
- **MEDIUM:** `CATEGORIES` includes `Uncategorized`, but user decisions say category is optional and uncategorized is a grouping fallback. It should not be a normal selectable category unless intentionally stored.
- **MEDIUM:** Attribution by `charCodeAt(0) % 2` is too collision-prone. Two people with similar names can get the same color, and changing the name can change attribution color.
- **MEDIUM:** Optimistic rollback can clobber later local changes if it snapshots and restores the whole items array.
- **LOW:** The plan mentions optimistic CRUD but not initial `fetchItems`, loading state, or error state.

**Suggestions**
- Add exact migration SQL to the plan, including policy names, roles, `USING`, and `WITH CHECK`.
- Split category constants into selectable categories and grouping categories.
- Use a stable full-string hash or stored local device/person id for attribution color.
- Make store actions patch-based: rollback only the item/action that failed.
- Define `fetchItems(listId)`, `isLoading`, `error`, and pending mutation behavior.

**Risk Assessment:** MEDIUM-HIGH

### Plan 02-02: Add & View Vertical Slice

**Strengths**
- Matches the user decisions closely: single top input, expandable details, grouped display, local name prompt.
- Component breakdown is clean and testable.
- Mobile tap target attention is appropriate.
- LocalStorage name per list is simple and fits the two-person app constraint.

**Concerns**
- **MEDIUM:** ListPage orchestration does not explicitly include loading existing items from Supabase.
- **MEDIUM:** Add behavior needs trim/blank handling, duplicate-submit prevention, pending/error feedback, and field reset behavior.
- **MEDIUM:** The sticky/pinned add input needs mobile Safari keyboard and safe-area consideration.
- **MEDIUM:** Accessibility gap: the initials/color badge conveys "who added this," so screen readers need an accessible text equivalent.
- **LOW:** Sorting within each category is not specified. Created order should be deterministic.
- **LOW:** A mandatory non-dismissable dialog can trap users if list loading or storage logic fails.

**Suggestions**
- Add explicit ListPage lifecycle: validate/load list, load items, load name, then render.
- Define add normalization: trim name, empty quantity/category as `null`, no selectable `Uncategorized`.
- Add deterministic sort: category order first, then `created_at` or insertion order.
- Include accessible labels like "Added by Mitch" on the badge or row metadata.
- Keep all form text at 16px or larger to avoid iOS input zoom.

**Risk Assessment:** MEDIUM

### Plan 02-03: Edit & Delete Vertical Slice

**Strengths**
- Inline edit and inline delete confirmation match the product's simplicity goal.
- Limiting edit mode to one item at a time is the right constraint.
- Trash only in edit mode reduces accidental deletes.
- Auto-focus and keyboard handling are considered.

**Concerns**
- **HIGH:** "Save on blur" is tricky with multiple fields, Select, trash, cancel, and delete buttons. Blur can fire when moving between controls and prematurely save/exit.
- **HIGH:** Clicking the trash icon may trigger blur-save before delete confirmation opens unless event/focus handling is carefully designed.
- **MEDIUM:** Category Select blur/open behavior can conflict with inline edit mode.
- **MEDIUM:** Empty-name revert is silent; users may not understand why their edit disappeared.
- **MEDIUM:** UI state ownership is inconsistent. Plan 02-03 says ListPage reads `deletingItemId` from the store, but Plan 02-01 does not define edit/delete UI state in Zustand.
- **LOW:** No dirty-check/deduping is specified, so blur/Enter could issue redundant updates.

**Suggestions**
- Treat the edit row as a focus scope/form: save when focus leaves the whole row, not when any single input blurs.
- Guard internal clicks with `onMouseDown`/focus handling so trash, cancel, confirm, and Select interactions do not accidentally commit and close.
- Keep `editingItemId` and `deletingItemId` local to ListPage unless there is a clear cross-page reason for Zustand.
- Only call `updateItem` when fields are dirty and normalized.
- Consider showing inline validation for empty names instead of silently reverting.

**Risk Assessment:** MEDIUM-HIGH

---

## Consensus Summary

*(Single reviewer — consensus analysis requires 2+ reviewers)*

### Key Concerns (prioritized)

1. **Inline edit blur/focus interactions (HIGH)** — Save-on-blur conflicts with trash icon, Select dropdown, and Cancel button clicks. Needs focus-scope approach or mousedown guards.
2. **RLS policy specificity (HIGH)** — UPDATE/DELETE policies need exact SQL with USING + WITH CHECK clauses documented.
3. **Category null/Uncategorized semantics (MEDIUM)** — Uncategorized should be a grouping fallback only, not a selectable dropdown value.
4. **Attribution color collisions (MEDIUM)** — charCodeAt(0) % 2 can produce same color for names starting with same-parity characters.
5. **Mobile form considerations (MEDIUM)** — iOS input zoom at <16px, Safari keyboard safe-area, sticky input behavior.
6. **Optimistic rollback granularity (MEDIUM)** — Per-item rollback preferred over full array snapshot.

### Strengths Confirmed
- Vertical slice architecture (foundation → add/view → edit/delete)
- Optimistic CRUD pattern for responsive UX
- Clean component decomposition with testable utilities
- Mobile tap target sizing (48px)
- Security-first approach with RLS before UI

### Divergent Views
*(Single reviewer — no divergent views to report)*
