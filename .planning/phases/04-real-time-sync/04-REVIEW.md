---
phase: 04-real-time-sync
reviewed: 2026-05-26T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/pages/ListPage.tsx
  - src/stores/itemsStore.ts
  - src/pages/ListPage.test.tsx
  - src/stores/itemsStore.test.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 04: Code Review Report (04-04 Gap Closure)

**Reviewed:** 2026-05-26T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This review covers the gap closure work from plan 04-04 (offline/online syncStatus detection). The implementation adds `offline`/`online` browser event handlers in ListPage, belt-and-suspenders `syncStatus` transitions on mutation failures when `navigator.onLine` is false, and corresponding test coverage. The SyncStatus component and core subscription logic are reviewed in context.

The code is generally well-structured with good defensive patterns (idempotent merge reducer, per-item rollback, dedup guards). However, the review identified one critical-tier issue (items flicker away during background re-fetch), two structural warnings around the `inFlightListId` dedup guard, and one warning about the UPDATE branch in the merge reducer creating unnecessary state updates.

## Critical Issues

### CR-01: Background re-fetch sets `loading: true`, causing items to disappear and reappear

**File:** `src/stores/itemsStore.ts:47`
**Issue:** `fetchItems` unconditionally sets `loading: true` on every call. In ListPage, the item list is gated by `!itemsLoading` (line 280: `{!itemsLoading && grouped.map(...)}`), so whenever `fetchItems` is called from a background path -- `handleVisibility` (ListPage line 103), or `handleOnline` -> `subscribeToList` -> SUBSCRIBED (ListPage line 116 / itemsStore line 277) -- the entire items list visually disappears and "Loading items..." appears until the fetch resolves. For a user returning to the app after screen lock or network loss, the grocery list vanishes for the duration of the network round-trip, then reappears. This is a jarring UX defect for the primary shopping use case.

**Fix:** Add an `isBackgroundFetch` parameter to `fetchItems`, or only set `loading: true` when items are currently empty:
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
Then pass `{ background: true }` from the SUBSCRIBED callback (when items already exist) and from `handleVisibility`. The initial fetch on first load can use the default `background: false`.

## Warnings

### WR-01: `inFlightListId` dedup guard suppresses needed fetch when prior in-flight fetch fails on same-list re-subscribe

**File:** `src/stores/itemsStore.ts:274-281`
**Issue:** When `subscribeToList` is called for the same `listId` while a fetch is already in flight (e.g., `handleOnline` triggers re-subscribe during screen wake), the guard `if (inFlightListId !== listId)` skips the fetch. If the first in-flight fetch subsequently fails (network error, timeout), `inFlightListId` is cleared in `.finally()`, but the second subscription never gets its own fetch. The user ends up with `syncStatus: 'live'` (set by SUBSCRIBED) but stale or missing items, with no automatic retry. The test at `itemsStore.test.ts:328` only tests different list IDs, not this same-list-re-subscribe-with-failure scenario.

**Fix:** Clear `inFlightListId` on error AND schedule a retry, or restructure the guard to allow a second fetch when the first fails:
```typescript
if (status === 'SUBSCRIBED') {
  set({ syncStatus: 'live' })
  // Always fetch on SUBSCRIBED; dedup via AbortController instead of boolean guard
  const controller = new AbortController()
  get()
    .fetchItems(listId, { signal: controller.signal })
    .catch(() => {})
}
```
Alternatively, keep the simple guard but clear it on error so the next SUBSCRIBED (from Supabase's auto-reconnect) triggers a fresh fetch:
```typescript
get()
  .fetchItems(listId)
  .catch(() => { inFlightListId = null })
  .finally(() => {
    if (inFlightListId === listId) inFlightListId = null
  })
```

### WR-02: `handleVisibility` calls `fetchItems` directly, bypassing the `inFlightListId` dedup guard

**File:** `src/pages/ListPage.tsx:101-104`
**Issue:** The `handleVisibility` handler calls `useItemsStore.getState().fetchItems(list!.id)` directly, bypassing the `inFlightListId` guard that only exists inside `subscribeToList`'s SUBSCRIBED callback. When a phone wakes up, both `visibilitychange` and `online` can fire in quick succession. `handleVisibility` fires an unguarded `fetchItems`, and `handleOnline` triggers `subscribeToList` which fires a guarded `fetchItems` on SUBSCRIBED. Since the visibility fetch doesn't set `inFlightListId`, the SUBSCRIBED fetch also fires -- resulting in two concurrent fetches for the same list. While the last-write-wins semantics are correct, the double fetch is wasteful and compounds the CR-01 loading flash (two consecutive flashes if one resolves before the other starts).

**Fix:** Route the visibility handler through the same dedup mechanism, or at minimum check the guard:
```typescript
function handleVisibility() {
  if (document.visibilityState === 'visible') {
    // Re-subscribe is the full recovery path; it dedupes internally
    useItemsStore.getState().subscribeToList(list!.id)
  }
}
```
This makes `handleVisibility` and `handleOnline` use the same recovery path, consolidating the dedup logic in one place. The subscription is idempotent (removes existing channel first), so calling it on visibility change is safe.

### WR-03: Merge reducer UPDATE branch always creates a new array reference even when no item matches

**File:** `src/stores/itemsStore.ts:250-258`
**Issue:** The UPDATE branch of the Realtime merge reducer always returns `{ items: state.items.map(...) }`, creating a new array reference even when no item in the local state matches the updated row's ID (e.g., the item was optimistically deleted). The comment acknowledges this is "intentional no-op when the id is absent locally" but `.map()` returns a new array reference regardless, which Zustand treats as a state change, triggering React re-renders. The DELETE branch (line 260-264) correctly returns `state` (same reference) when there's nothing to delete. The UPDATE branch should follow the same pattern for consistency and to avoid unnecessary renders.

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

---

_Reviewed: 2026-05-26T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
