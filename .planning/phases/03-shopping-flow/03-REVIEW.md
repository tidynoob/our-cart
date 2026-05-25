---
phase: 03-shopping-flow
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/components/CategorySection.tsx
  - src/components/ItemRow.test.tsx
  - src/components/ItemRow.tsx
  - src/components/ui/checkbox.tsx
  - src/pages/ListPage.test.tsx
  - src/pages/ListPage.tsx
  - src/stores/itemsStore.test.ts
  - src/stores/itemsStore.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-25  
**Depth:** standard  
**Files Reviewed:** 8  
**Status:** issues_found

## Summary

Phase 3 introduced optimistic check-off (`toggleChecked`), strikethrough/dim styling, and bulk-delete of completed items (`clearChecked`) with a confirmation dialog. The optimistic-update and rollback logic is structurally sound for the happy path, but there is one blocker: the `clearChecked` rollback re-inserts items without checking for duplicates, meaning a concurrent real-time push of new items during the network round-trip can produce phantom duplicates in the store. Additionally, there are four warnings: a stale closure in `handleRowBlur` that can silently drop saves, an incorrect `onToggle` prop type declaration creating an interface lie, missing error clearing on successful operations, and a test that validates only network plumbing and not the optimistic store state for `clearChecked`. Two informational items cover the non-null assertion and rollback ordering.

---

## Critical Issues

### CR-01: `clearChecked` rollback re-inserts without deduplication — phantom duplicates on concurrent writes

**File:** `src/stores/itemsStore.ts:178-183`

**Issue:** The rollback path appends `checkedItems` to `state.items` unconditionally:

```ts
set((state) => ({
  items: [...state.items, ...checkedItems],
  error: 'Failed to clear items',
}))
```

If a real-time Supabase broadcast (or another concurrent action such as `addItem`) fires between the optimistic `set()` at line 168 and the error branch at line 178, the real-time handler may have already pushed some of those same items back into `state.items`. Re-appending `checkedItems` then creates duplicate entries for those items. Duplicates in the store cause duplicate React keys (`key={item.id}` in `CategorySection`), producing React warnings and visual doubling.

The same structural issue exists in `deleteItem` (line 131), where an item restored by a real-time push before the rollback fires would be appended a second time. However for `clearChecked` the risk is higher because it affects multiple items at once.

**Fix:** Filter out any IDs already present in state before re-inserting:

```ts
if (error) {
  set((state) => {
    const existingIds = new Set(state.items.map((i) => i.id))
    const toRestore = checkedItems.filter((i) => !existingIds.has(i.id))
    return {
      items: [...state.items, ...toRestore],
      error: 'Failed to clear items',
    }
  })
}
```

Apply the same fix to the `deleteItem` rollback at line 131.

---

## Warnings

### WR-01: Stale `handleSave` closure in `handleRowBlur` — edits silently dropped after fast typing

**File:** `src/components/ItemRow.tsx:114-121`

**Issue:** `handleRowBlur` closes over `handleSave`. `handleSave` is memoized with `useCallback` and depends on `[editName, editQuantity, editCategory, item, onSave, onCancelEdit]`. The blur handler is itself memoized with `useCallback` depending only on `[handleSave]`, so the chain is theoretically correct. However, the `setTimeout(0)` inside `handleRowBlur` schedules a macrotask. If the user types rapidly and then immediately clicks outside the row, the `setTimeout` callback fires with the `handleSave` that was current at blur-time. Because `handleSave` is recreated on every keystroke (state changes → new `useCallback`), and `handleRowBlur` is also recreated each time, this is actually correct in the steady state.

The problem is a narrower race: if the user types a character, React batches the state update, the blur fires _before_ the render that would produce the new `handleSave`, and `setTimeout(0)` fires after React has flushed but with the previous `handleSave` snapshot from before the keystroke. In practice with React 19 automatic batching this window is very small, but it means the last-keystroke character can be silently dropped. This is a pre-existing architectural fragility that this phase carries forward without mitigation.

**Fix:** Read state directly in the blur callback rather than closing over memoized `handleSave`, or use a ref to hold the latest `handleSave`:

```ts
const handleSaveRef = useRef(handleSave)
useEffect(() => { handleSaveRef.current = handleSave }, [handleSave])

const handleRowBlur = useCallback(() => {
  setTimeout(() => {
    if (selectOpenRef.current) return
    if (rowRef.current && !rowRef.current.contains(document.activeElement)) {
      handleSaveRef.current()
    }
  }, 0)
}, []) // stable — always reads latest via ref
```

### WR-02: `onToggle` prop type in `ItemRow` declares `(id: string) => void` but the call site never supplies an id that matters

**File:** `src/components/ItemRow.tsx:29` and `src/components/CategorySection.tsx:61`

**Issue:** `ItemRow` declares `onToggle: (id: string) => void`, and calls `onToggle(item.id)` at line 246. However, `CategorySection` always supplies this prop as `() => onToggle(item.id)` — a zero-parameter closure that ignores any argument. This compiles silently in TypeScript because a function with fewer declared parameters is assignable to a function type expecting more (structural subtyping). The result is an interface lie: the type says the caller provides the id, but the implementation has already captured it.

If a future developer refactors `ItemRow` to call `onToggle()` without an argument (reasonably, since the closure already has the id), TypeScript will erroneously flag the call site. Conversely, the current `onToggle(item.id)` call is wasted work. The prop should either be `() => void` throughout (closure pattern, id captured in `CategorySection`) or `(id: string) => void` at both layers (id passed through, no closure).

**Fix:** Change `ItemRow`'s `onToggle` prop to `() => void` and update the call site:

```tsx
// ItemRow.tsx — prop type
onToggle: () => void

// ItemRow.tsx — call site (line 246)
onCheckedChange={() => onToggle()}

// CategorySection.tsx — already correct: () => onToggle(item.id)
```

This matches the pattern already used by `onTap`, `onDelete`, `onCancelDelete`, and `onConfirmDelete`, all of which are `() => void` in `ItemRow`.

### WR-03: Error state is never cleared on successful toggle or clearChecked — stale error banner persists

**File:** `src/stores/itemsStore.ts:135-159` and `src/stores/itemsStore.ts:162-185`

**Issue:** `toggleChecked` and `clearChecked` do not clear `state.error` on the optimistic path or on success. If a previous action (e.g., an `addItem` failure) left `error: 'Failed to add item'` in the store, then a successful `toggleChecked` leaves the error banner visible even though the state is now consistent. Inconsistently, `fetchItems` always clears error (`set({ loading: true, error: null })`), so a Retry click would clear it, but routine interactions do not.

The existing `updateItem` and `deleteItem` have the same gap (pre-existing), but this phase adds two new actions without fixing the pattern.

**Fix:** Clear error at the start of each mutating action, consistent with `fetchItems`:

```ts
toggleChecked: async (id) => {
  const prev = get().items.find((i) => i.id === id)
  if (!prev) return
  const nextChecked = !prev.checked
  set((state) => ({
    items: state.items.map((i) => i.id === id ? { ...i, checked: nextChecked } : i),
    error: null,   // clear stale error
  }))
  // ...
},

clearChecked: async (listId) => {
  const checkedItems = get().items.filter((i) => i.checked)
  if (checkedItems.length === 0) return
  set((state) => ({
    items: state.items.filter((i) => !i.checked),
    error: null,   // clear stale error
  }))
  // ...
},
```

### WR-04: `clearChecked` rollback silently uses the Supabase `checked` column as a boolean literal — breaks if DB uses integer 1/0

**File:** `src/stores/itemsStore.ts:175-176`

**Issue:** The Supabase delete filter uses `.eq('checked', true)`:

```ts
.delete()
.eq('list_id', listId)
.eq('checked', true)
```

The `supabase-js` client serializes the `true` boolean as a query parameter. If the Postgres column `checked` is typed as `boolean` this works. However, if RLS or the column type was defined as `int2` or `smallint` (common when the schema was hand-authored), Supabase will serialize it as `true` (string) and the filter will match zero rows, silently succeeding with no deletions. The optimistic removal happens anyway, so the UI shows the items gone, but they are still in the database. On the next `fetchItems` they reappear — a data-integrity bug that looks like a ghost.

This is unverifiable from the code alone (schema is external), but the risk is high enough to flag. The test mock accepts any value and does not validate the type passed.

**Fix:** Confirm the Postgres column is typed `boolean` (not integer). If uncertain, add a schema check or migration comment:

```sql
-- Verify in Supabase SQL editor:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'items' AND column_name = 'checked';
-- Must return 'boolean', not 'smallint' or 'integer'
```

If the column is integer, change the filter to `.eq('checked', 1)`.

---

## Info

### IN-01: Non-null assertion `list!.id` in `handleClearConfirm` — unnecessary given control flow

**File:** `src/pages/ListPage.tsx:153`

**Issue:** `handleClearConfirm` uses `list!.id`. The assertion is safe because the dialog and the "Clear completed" button are only rendered after the `if (error || !list)` early return guard (lines 164-173), so `list` is always non-null when `handleClearConfirm` can be called. However, TypeScript cannot infer this across the component, so the assertion silences a legitimate type error rather than restructuring code.

**Fix:** Extract `list.id` from the enclosing scope with an early return, or pass `list.id` as a parameter to avoid assertions:

```tsx
function handleClearConfirm() {
  if (!list) return  // defensive, narrowing list for TS
  setClearDialogOpen(false)
  clearChecked(list.id).catch(() => {})
}
```

### IN-02: `deleteItem` rollback appends to end of array — item reappears at wrong position on error

**File:** `src/stores/itemsStore.ts:131`

**Issue:** On rollback, the deleted item is appended to the end of the items array (`[...state.items, prev]`). Since the list is ordered by `created_at` and displayed in insertion order, the item will jump to the bottom of its category section after an unsuccessful delete. This is a visible flash for the user during an already-failed operation.

**Fix:** Restore the item at its original index, captured before the optimistic removal:

```ts
deleteItem: async (id) => {
  const prevItems = get().items
  const prevIndex = prevItems.findIndex((i) => i.id === id)
  const prev = prevItems[prevIndex]
  if (!prev) return

  set((state) => ({ items: state.items.filter((i) => i.id !== id) }))

  const { error } = await supabase.from('items').delete().eq('id', id)

  if (error) {
    set((state) => {
      const next = [...state.items]
      next.splice(prevIndex, 0, prev)
      return { items: next, error: 'Failed to delete item' }
    })
  }
},
```

---

_Reviewed: 2026-05-25_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
