---
phase: 04-real-time-sync
reviewed: 2026-05-26T18:30:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/components/SyncStatus.tsx
  - src/components/SyncStatus.test.tsx
  - src/lib/supabase.ts
  - src/pages/ListPage.tsx
  - src/pages/ListPage.test.tsx
  - src/stores/itemsStore.ts
  - src/stores/itemsStore.test.ts
findings:
  critical: 2
  warning: 4
  info: 0
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-26T18:30:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This review covers the real-time sync implementation across the itemsStore (subscription lifecycle, merge reducer, optimistic mutations with offline detection), the SyncStatus indicator component, the ListPage integration (event handlers for visibility/offline/online), the Supabase client configuration, and all associated test files.

The architecture is generally solid: idempotent merge reducer, per-item rollback on mutation failure, dedup guard for in-flight fetches, and defensive offline detection. However, the review surfaced two critical-tier bugs (duplicate items from a Realtime/optimistic race, and UI flicker from unconditional `loading: true` on background re-fetches), plus four warnings around dedup guard edge cases, unnecessary re-renders, unguarded concurrent fetches, and the `useEffect` dependency array including unstable references.

## Critical Issues

### CR-01: addItem + Realtime INSERT race produces duplicate items in the UI

**File:** `src/stores/itemsStore.ts:62-103` and `src/stores/itemsStore.ts:244-248`
**Issue:** When `addItem` is called, an optimistic item is appended with a temporary `nanoid()` ID (e.g., `"temp-abc"`). The Supabase `.insert()` creates a server row with a different server-generated UUID (e.g., `"srv-uuid-1"`). If the Realtime INSERT event for `"srv-uuid-1"` arrives before the `.insert().select().single()` HTTP response, the echo guard on line 247 (`state.items.some(i => i.id === id)`) checks for `"srv-uuid-1"`, finds no match (only `"temp-abc"` exists locally), and appends the server row. Now the items array contains both `"temp-abc"` and `"srv-uuid-1"`. When the HTTP response finally arrives, line 101 replaces `"temp-abc"` with `"srv-uuid-1"` via `.map()`, resulting in TWO items with id `"srv-uuid-1"`. The user sees a duplicate grocery item until the next full `fetchItems` call replaces the entire array.

This race is realistic: Supabase Realtime often delivers change events faster than the HTTP response round-trip, especially on mobile networks with higher HTTP latency.

**Fix:** Track pending temp IDs so the INSERT echo guard can also deduplicate by name+list_id during the optimistic window, or replace the temp item when the Realtime INSERT arrives (preferred approach):
```typescript
// Option A: Track pending temp IDs in a Set alongside the Zustand state
// In addItem, before insert:
pendingTempIds.add(tempId)

// In addItem success response:
pendingTempIds.delete(tempId)
set((state) => ({
  items: state.items.map((i) => (i.id === tempId ? data : i)),
}))

// In the INSERT merge reducer:
if (eventType === 'INSERT') {
  const id = (newRow as Item).id
  if (state.items.some((i) => i.id === id)) return state
  // Check if this server row matches a pending optimistic item — replace it
  const tempEntry = [...pendingTempIds].find((tid) =>
    state.items.some((i) => i.id === tid && i.name === (newRow as Item).name)
  )
  if (tempEntry) {
    pendingTempIds.delete(tempEntry)
    return { items: state.items.map((i) => i.id === tempEntry ? (newRow as Item) : i) }
  }
  return { items: [...state.items, newRow as Item] }
}
```

### CR-02: Background re-fetch sets `loading: true`, causing the item list to vanish and reappear

**File:** `src/stores/itemsStore.ts:47`
**Issue:** `fetchItems` unconditionally sets `{ loading: true }`. In ListPage (line 280), item rendering is gated by `{!itemsLoading && grouped.map(...)}`, so every background re-fetch (from `handleVisibility` on screen wake, from `handleOnline` -> `subscribeToList` -> SUBSCRIBED callback, or from Supabase auto-reconnect) causes the entire grocery list to disappear and be replaced with "Loading items..." until the fetch resolves. For the primary use case -- a shopper at the store unlocking their phone -- the list vanishes for the duration of a network round-trip, which is a jarring and potentially confusing UX defect.

**Fix:** Add a background fetch mode that skips the loading indicator when items already exist:
```typescript
fetchItems: async (listId, { background = false } = {}) => {
  if (!background) {
    set({ loading: true, error: null })
  } else {
    set({ error: null })
  }
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true })

  if (error) {
    set({ error: 'Failed to load items', loading: false })
  } else {
    set({ items: data ?? [], loading: false })
  }
},
```
Pass `{ background: true }` from the SUBSCRIBED callback (when items are already populated) and from `handleVisibility`. The initial page load uses the default `background: false`.

## Warnings

### WR-01: `inFlightListId` dedup guard suppresses needed fetch when prior same-list fetch fails

**File:** `src/stores/itemsStore.ts:274-281`
**Issue:** When `subscribeToList` is called for the same `listId` while a fetch is already in flight (e.g., `handleOnline` triggers re-subscribe during screen wake, Supabase auto-reconnects), the guard `if (inFlightListId !== listId)` skips the fetch entirely. If the first in-flight fetch subsequently fails (network error, timeout), `inFlightListId` is cleared in `.finally()`, but the SUBSCRIBED callback from the second subscription has already fired and been skipped. The user sees `syncStatus: 'live'` (set on line 272) but has stale or missing items, with no automatic recovery path. The test at `itemsStore.test.ts:328` only covers the different-list-ID scenario, not this same-list-re-subscribe-with-failure edge case.

**Fix:** Clear `inFlightListId` on error so subsequent SUBSCRIBED callbacks can trigger a fresh fetch, or use AbortController to cancel stale fetches instead of skipping:
```typescript
get()
  .fetchItems(listId)
  .catch(() => { inFlightListId = null }) // Allow retry on next SUBSCRIBED
  .finally(() => {
    if (inFlightListId === listId) inFlightListId = null
  })
```

### WR-02: `handleVisibility` calls `fetchItems` directly, bypassing the `inFlightListId` dedup guard

**File:** `src/pages/ListPage.tsx:101-104`
**Issue:** The `handleVisibility` handler calls `useItemsStore.getState().fetchItems(list!.id)` directly, completely outside the `inFlightListId` guard (which only exists inside `subscribeToList`'s SUBSCRIBED callback). When a phone wakes up from screen lock, both `visibilitychange` and `online` events can fire in rapid succession. `handleVisibility` fires an unguarded `fetchItems`, while `handleOnline` triggers `subscribeToList` which fires its own `fetchItems` on SUBSCRIBED. This results in two concurrent `fetchItems` calls for the same list. Since `fetchItems` has no internal concurrency control, the second call's `set({ loading: true })` can overwrite the first call's results, and the last response to arrive wins -- potentially with stale data if network reordering occurs.

**Fix:** Route the visibility handler through the same recovery path as online:
```typescript
function handleVisibility() {
  if (document.visibilityState === 'visible') {
    // Re-subscribe is the full recovery path; it dedupes internally
    useItemsStore.getState().subscribeToList(list!.id)
  }
}
```
This consolidates recovery into a single path and leverages the existing dedup guard.

### WR-03: Merge reducer UPDATE branch creates a new array reference even when no item matches

**File:** `src/stores/itemsStore.ts:250-258`
**Issue:** The UPDATE branch always returns `{ items: state.items.map(...) }`, which creates a new array reference even when no item in local state matches the updated row's ID (e.g., the row was optimistically deleted by this client). Zustand treats a new object reference as a state change, triggering a React re-render of every component subscribed to `items`. The DELETE branch (lines 260-264) correctly returns `state` (same reference) when there is nothing to delete. The UPDATE branch should follow the same pattern to avoid unnecessary renders on every Realtime UPDATE event for items that have been locally removed.

**Fix:**
```typescript
if (eventType === 'UPDATE') {
  const updatedId = (newRow as Item).id
  if (!state.items.some((i) => i.id === updatedId)) return state
  return {
    items: state.items.map((i) =>
      i.id === updatedId ? (newRow as Item) : i
    ),
  }
}
```

### WR-04: `useEffect` dependency array includes `subscribeToList` and `unsubscribe` extracted via selector, risking re-subscribe loops if Zustand store is recreated

**File:** `src/pages/ListPage.tsx:129`
**Issue:** The second `useEffect` (line 87-129) has `[list, subscribeToList, unsubscribe]` in its dependency array. `subscribeToList` and `unsubscribe` are extracted from Zustand via `useItemsStore((state) => state.subscribeToList)` (line 55-56). Zustand's `create` produces stable function references for action methods defined in the store initializer, so in practice these references do not change and this effect does not re-fire spuriously. However, this relies on an implementation detail of Zustand rather than an explicit guarantee. If a future refactor (e.g., adding middleware, or dynamically replacing the store slice) causes these references to change, the effect will re-fire, calling `unsubscribe()` followed by `subscribeToList(list.id)` in a loop. The safer pattern is to access actions via `useItemsStore.getState()` inside the effect body (as the event handlers already do) and remove them from the dependency array, or use `useRef` to hold stable references.

**Fix:** Remove action functions from the dependency array and access them via `getState()`:
```typescript
useEffect(() => {
  if (!list) return

  const { subscribeToList, unsubscribe } = useItemsStore.getState()
  subscribeToList(list.id)

  // ... event handlers (already use getState()) ...

  return () => {
    useItemsStore.getState().unsubscribe()
    // ... remove event listeners ...
  }
}, [list]) // Only re-run when the list identity changes
```

---

_Reviewed: 2026-05-26T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
