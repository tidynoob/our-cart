---
phase: 02-list-management
fixed_at: 2026-05-25T14:45:00Z
review_path: .planning/phases/02-list-management/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-25T14:45:00Z
**Source review:** .planning/phases/02-list-management/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01 through WR-05)
- Fixed: 7
- Skipped: 0

Info findings (IN-01, IN-02, IN-03) were out of scope for this fix run and were not addressed.

## Fixed Issues

### CR-01: AddItemBar permanently locks on unhandled exception from addItem

**Files modified:** `src/components/AddItemBar.tsx`
**Commit:** a91057f
**Applied fix:** Wrapped the `await addItem(...)` call and the subsequent
field-reset logic in a `try { ... } finally { setSubmitting(false) }` block.
If `addItem` throws (network exception, client crash), `submitting` is now
always reset to `false`, so the form can no longer become permanently
disabled. The success-only resets (`setName('')`, etc.) remain inside the
`try` so fields are not cleared on failure.

### CR-02: Silent data loss on failed optimistic mutations -- no user feedback

**Files modified:** `src/stores/itemsStore.ts`, `src/pages/ListPage.tsx`
**Commit:** e162899
**Applied fix:** On the server-error branch of `addItem`, `updateItem`, and
`deleteItem`, the store now sets a specific `error` message
(`'Failed to add item'` / `'Failed to update item'` / `'Failed to delete
item'`) alongside the existing per-item rollback. ListPage's error banner
now renders the store's `itemsError` message verbatim instead of the
hard-coded "Could not load items" string, so failed mutations surface to
the user (with a Retry that re-fetches canonical server state). The
fetch-failure path still sets a sensible `'Failed to load items'` message.
No existing test asserted the old string.

### WR-01: Dead code -- editingItemId and setEditingItemId in Zustand store are unused

**Files modified:** `src/stores/itemsStore.ts`
**Commit:** 343fcf8
**Applied fix:** Removed `editingItemId: string | null` and
`setEditingItemId` from the `ItemsState` interface and the store
implementation (initial value and setter). Confirmed via grep that the only
`setEditingItemId`/`editingItemId` references in the codebase are ListPage's
local `useState`, which is unaffected.

### WR-02: Misleading test asserts coincidental hash property as a design guarantee

**Files modified:** `src/lib/attribution.ts`, `src/lib/attribution.test.ts`
**Commit:** e92e6bd
**Applied fix:** Chose recommended option (a). Updated the three doc comments
in `attribution.ts` (file header, `getColorSlot`, `getAttributionColor`) to
accurately describe the algorithm as deterministic per exact name string and
explicitly NOT nickname-resistant. Removed the test that asserted
"Mitch"/"Mitchell" map to the same color, which enshrined a coincidence as a
feature. The cross-name test ("Mitch" vs "Sarah") was left in place as it is
flagged under Info finding IN-02, which is out of scope.

### WR-03: ListPage calls async store actions without await, masking unhandled rejections

**Files modified:** `src/pages/ListPage.tsx`
**Commit:** 1e74136
**Applied fix:** Attached `.catch(() => {})` to the `updateItem(id, changes)`
call in `handleSave` and the `deleteItem(id)` call in `handleConfirmDelete`.
The store still owns rollback and error state internally (see CR-02); the
`.catch()` only prevents a network-level throw from becoming an unhandled
promise rejection.

### WR-04: AddItemBar is usable before name prompt completes, allowing anonymous items

**Files modified:** `src/components/AddItemBar.tsx`, `src/pages/ListPage.tsx`
**Commit:** cb1d16e
**Applied fix:** Took the more defensive of the two suggested options. Added
an optional `disabled?: boolean` prop to `AddItemBar`, derived an `isInert =
submitting || disabled` flag, and used it to gate `handleSubmit` and the
disabled state of all inputs, the submit button, and the category select.
ListPage now passes `disabled={userName === null}`. This keeps the bar
mounted (preserving any in-progress form state) while making it impossible
to create an item with an empty `addedBy` before the name prompt completes,
even if the modal's focus trap is bypassed.

### WR-05: getInitials returns empty string for empty name input

**Files modified:** `src/lib/attribution.ts`, `src/lib/attribution.test.ts`
**Commit:** f5ba7e7
**Applied fix:** Added a `if (name.length === 0) return '?'` guard to
`getInitials` so an empty name renders a visible `'?'` badge instead of an
invisible empty one, mirroring the existing empty-string guard in
`getColorSlot`. Added a test asserting `getInitials('') === '?'` to cover the
previously untested edge case.

## Skipped Issues

None -- all in-scope findings were fixed.

---

_Fixed: 2026-05-25T14:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
