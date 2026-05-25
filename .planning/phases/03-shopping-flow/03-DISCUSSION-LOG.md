# Phase 3: Shopping Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 3-Shopping Flow
**Areas discussed:** Check-off gesture, Checked item placement, Clear-completed control, Checked visual style

---

## Check-off Gesture

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox left of name | Tappable checkbox/circle toggles checked; row tap still opens edit. No gesture conflict. | ✓ |
| Tap row = check, edit elsewhere | Row tap toggles checked; edit moves to long-press / pencil icon. Reworks Phase 2 entry point. | |
| Swipe to check | Swipe row to check. Needs gesture lib, no desktop equivalent, hides action. | |

**User's choice:** Checkbox left of name

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox far left, badge after | Order: [checkbox] [badge] name … qty. | ✓ |
| Checkbox left, badge right | Move badge to right near qty. More Phase 2 layout change. | |
| You decide | Let planning pick cleanest 44px-target arrangement. | |

**User's choice:** Checkbox far left, badge after
**Notes:** Tap-on-row already opens edit mode (Phase 2), so check-off needed its own control — central decision of the phase.

---

## Checked Item Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in place | Item stays in its category, dimmed/struck. Zero movement. | ✓ |
| Sink to bottom of category | Checked items drop to bottom of their category section. Adds reorder logic. | |
| Move to 'Done' section | All checked items collect in one bottom 'Done' section. Loses category context. | |

**User's choice:** Stay in place

---

## Clear-completed Control

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom button, only when checked exist | "Clear completed (N)" below list, shown only when checked items exist. | ✓ |
| Always-visible header action | Persistent header control; takes space, often disabled. | |
| Per-checked-item swipe/delete | One at a time. Doesn't satisfy SHOP-03 single-action clear. | |

**User's choice:** Bottom button, only when checked exist

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Centered dialog "Remove N checked items?" Cancel/Clear. Reuses shadcn Dialog. | ✓ |
| Inline button morph | Button morphs to Confirm/Cancel, like Phase 2 DeleteConfirmation. | |
| Undo toast instead | Clear immediately + Undo toast. Conflicts with SHOP-04 (requires confirm before removal). | |

**User's choice:** Modal dialog

---

## Checked Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Strikethrough + dimmed | Filled checkbox, line-through name, reduced opacity. Strongest done signal. | ✓ |
| Dimmed only | Filled checkbox, muted color, no line-through. Subtler. | |
| Strikethrough only | Line-through, full opacity. Checked items stay visually heavy. | |

**User's choice:** Strikethrough + dimmed

---

## Claude's Discretion

- Store actions `toggleChecked` / `clearChecked` implementation (optimistic + rollback pattern).
- Checked-count derivation from existing `items` array.
- shadcn Checkbox install vs custom accessible toggle.

## Deferred Ideas

None — discussion stayed within phase scope.
