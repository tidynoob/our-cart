# Phase 2: List Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 02-list-management
**Areas discussed:** Item entry UX, Category system, Attribution display (LIST-04), Edit & delete patterns

---

## Item Entry UX

### How should adding items work?

| Option | Description | Selected |
|--------|-------------|----------|
| Single field + expand | Text input for name + Add button always visible. Tapping expand reveals quantity and category fields. Enter/tap submits with name only. | ✓ |
| All fields visible | Name, quantity, and category inputs always shown in a compact form above the list. | |
| Bottom sheet / modal | Floating "+" button at bottom. Tapping opens a bottom sheet with all fields. | |

**User's choice:** Single field + expand
**Notes:** None

### Where should the add-item input live?

| Option | Description | Selected |
|--------|-------------|----------|
| Top of list | Input pinned above items. Always visible without scrolling. Standard list app pattern. | ✓ |
| Bottom of screen (sticky) | Input fixed to bottom edge like a chat input. Thumb-friendly on phone. | |

**User's choice:** Top of list
**Notes:** None

---

## Category System

### How should categories work?

| Option | Description | Selected |
|--------|-------------|----------|
| Predefined dropdown | Fixed list of ~8 grocery categories. Dropdown selector. Items without category go to "Uncategorized". | ✓ |
| Free-text with autocomplete | Type whatever. App suggests from previously used categories. | |
| Predefined + custom option | Dropdown with standard categories plus "Add custom..." option. | |

**User's choice:** Predefined dropdown
**Notes:** None

### How should categorized items display?

| Option | Description | Selected |
|--------|-------------|----------|
| Section headers | Items grouped under bold category headers. Empty categories hidden. Uncategorized at bottom. | ✓ |
| Color-coded labels | No visual grouping. Each item shows a small colored tag with category name. Flat list sorted by category. | |

**User's choice:** Section headers
**Notes:** None

---

## Attribution Display (LIST-04)

### How should the app know who added each item?

| Option | Description | Selected |
|--------|-------------|----------|
| Name prompt on first visit | "What's your name?" dialog on first list visit. Stored in localStorage. | |
| Color-only (no names) | First visitor = blue dot, second = green dot. No prompt needed. | |
| Let Claude decide | Claude picks based on project context. | ✓ |

**User's choice:** Let Claude decide
**Notes:** None

### How should attribution appear on each item?

| Option | Description | Selected |
|--------|-------------|----------|
| Small initials badge | Colored circle with first letter of name next to item. Subtle. | ✓ |
| Colored left border | Thin colored bar on left edge of item row. No text. | |
| Name text below item | Small muted "added by Mitch" text under item name. | |

**User's choice:** Small initials badge
**Notes:** None

---

## Edit & Delete Patterns

### How should editing and deleting items work?

| Option | Description | Selected |
|--------|-------------|----------|
| Tap to edit inline | Tap item row to enter edit mode. Fields become editable in place. Trash icon appears while editing. | ✓ |
| Swipe to reveal actions | Swipe left on item row reveals Edit + Delete buttons. | |
| Visible edit/delete icons per row | Small pencil + trash icons always shown on right side. | |

**User's choice:** Tap to edit inline
**Notes:** None

### Should deleting require confirmation?

| Option | Description | Selected |
|--------|-------------|----------|
| No confirmation | Tap trash → item removed immediately. Fast. | |
| Brief confirmation | Tap trash → row highlights red with "Delete?" and cancel/confirm buttons. | ✓ |

**User's choice:** Brief confirmation
**Notes:** None

---

## Claude's Discretion

- **Attribution identity mechanism:** Name prompt on first list visit. localStorage per list. Written to `added_by` column.
- **Schema migration:** Add `added_by` text column to items table. Add UPDATE/DELETE RLS policies.
- **Color assignment for initials:** Deterministic color from name hash.

## Deferred Ideas

None — discussion stayed within phase scope
