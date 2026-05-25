# Phase 3: Shopping Flow - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the in-store shopping flow on top of Phase 2's item CRUD: a user can check off an item (it stays visible, shown struck-through and dimmed), uncheck it to restore active state, and clear all checked items in one action gated by an explicit confirmation. The `checked` boolean column already exists on the items table from Phase 1 — no schema change needed. No real-time sync (Phase 4), no mobile polish/autocomplete (Phase 5).

Requirements: SHOP-01, SHOP-02, SHOP-03, SHOP-04.

</domain>

<decisions>
## Implementation Decisions

### Check-off Gesture (SHOP-01, SHOP-02)
- **D-01:** Check off via a dedicated checkbox/circle control on the row, NOT by tapping the row. Tapping the row body still enters inline edit mode (Phase 2 behavior preserved — no gesture conflict).
- **D-02:** Row layout left-to-right: `[checkbox] [attribution badge] name … quantity`. Checkbox leads as the primary shopping action; the badge stays visible immediately after it. Checkbox must keep a ≥44px effective tap target (mobile shopping use).
- **D-03:** Toggling the checkbox flips `checked` both directions (check and uncheck use the same control).

### Checked Item Placement
- **D-04:** Checked items stay exactly in place within their category section — no reordering, no sinking, no separate "Done" section. You find a checked item where you last saw it.

### Checked Visual Style
- **D-05:** A checked item shows a filled checkbox, name with `line-through`, and reduced opacity (strikethrough + dimmed). Strongest at-a-glance "done" signal while shopping.

### Clear Completed (SHOP-03, SHOP-04)
- **D-06:** A "Clear completed (N)" button appears below the list and is rendered ONLY when at least one checked item exists. Hidden entirely otherwise — stays out of the way during shopping.
- **D-07:** Tapping Clear opens a modal confirmation dialog ("Remove N checked items?" → Cancel / Clear) using the already-installed shadcn Dialog. Removal happens only after explicit confirm (satisfies SHOP-04). A modal (not inline) is used because this is a bulk destructive action.

### Claude's Discretion
- **Store actions:** Add `toggleChecked(id)` and `clearChecked(listId)` to `itemsStore.ts`, following the existing optimistic-update + per-item rollback + `error` state pattern. `clearChecked` is a bulk delete of all rows where `checked = true` (Supabase `.delete().eq('list_id', …).eq('checked', true)`), with rollback restoring the removed items on failure.
- **Checked count:** Derive `N` (checked-item count) from the existing `items` array in the store — no new state field needed.
- **Checkbox component:** Use the shadcn Checkbox primitive if installed; otherwise install via `npx shadcn@latest add checkbox` (already anticipated in CLAUDE.md stack notes) or use an accessible custom toggle. Planner decides.
- **Edit-mode interaction:** Checkbox is part of display mode only; edit mode (Phase 2) is unchanged.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, $0 budget / 2-user constraints, mobile-first
- `.planning/REQUIREMENTS.md` — SHOP-01 through SHOP-04 (the requirements for this phase)
- `.planning/ROADMAP.md` §Phase 3 — Goal and success criteria

### Prior Phase
- `.planning/phases/02-list-management/02-CONTEXT.md` — Phase 2 decisions: tap-row-to-edit (D-09), inline delete confirmation (D-11), attribution badge layout (D-07), category grouping (D-06)

### Technology
- `CLAUDE.md` §Technology Stack — React 19, Vite 8, Supabase, Tailwind v4, Zustand, shadcn/ui (Dialog/Checkbox)

### Existing Schema
- `.planning/phases/01-foundation/01-01-PLAN.md` §Task 2 — items table SQL; `checked` column already present, RLS policies (UPDATE policy added in Phase 2 enables toggling `checked`; DELETE policy enables clear)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/itemsStore.ts` — optimistic CRUD store with per-item rollback + `error` pattern. Extend with `toggleChecked` and `clearChecked`. `Item` type already has `checked: boolean`.
- `src/components/ItemRow.tsx` — display mode (lines 214–243) is where the checkbox + strikethrough/dim styling go; edit mode unchanged. Attribution badge already rendered at far-left here.
- `src/components/CategorySection.tsx` — renders ItemRows; will pass a new check/uncheck handler through, same prop-drilling pattern as edit/delete.
- `src/components/DeleteConfirmation.tsx` — existing inline confirm pattern (reference, but D-07 chose a modal Dialog for clear).
- `src/components/ui/` — shadcn Button, Input, Select, Dialog already present.
- `src/pages/ListPage.tsx` — owns ephemeral UI state (editingItemId/deletingItemId, lines 32–33) and wires store actions. Add toggle handler + clear-button + clear-dialog state here; render "Clear completed" button after the category sections (around line 221).

### Established Patterns
- Optimistic mutation + rollback + `error` toast with Retry re-fetch (`itemsStore.ts`, surfaced in `ListPage.tsx:185-196`).
- Ephemeral per-page UI state lives in `ListPage` local `useState`, not Zustand (Phase 2 review decision).
- shadcn primitives + Tailwind v4 utilities; `min-h-[44px]`/`min-h-[48px]` tap targets already in use in ItemRow.

### Integration Points
- `ItemRow` display branch — add checkbox control + conditional strikethrough/dim classes driven by `item.checked`.
- `ListPage.tsx` after `grouped.map(...)` — render conditional "Clear completed (N)" button + confirmation Dialog.
- Supabase items table — UPDATE RLS (Phase 2) covers `checked` toggle; DELETE RLS (Phase 2) covers clear.

</code_context>

<specifics>
## Specific Ideas

- Checkbox must not collide with the tap-to-edit gesture: row body tap = edit, checkbox tap = toggle checked. This separation is the core UX decision of the phase.
- "Stay in place" placement was a deliberate simplicity choice over sinking/grouping checked items.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Shopping Flow*
*Context gathered: 2026-05-25*
