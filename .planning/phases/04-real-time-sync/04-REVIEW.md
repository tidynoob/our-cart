---
phase: 04-real-time-sync
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/supabase.ts
  - src/stores/itemsStore.ts
  - src/stores/itemsStore.test.ts
  - src/components/SyncStatus.tsx
  - src/components/SyncStatus.test.tsx
  - src/pages/ListPage.tsx
  - src/pages/ListPage.test.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase adds Supabase Postgres Changes real-time sync: `subscribeToList`/`unsubscribe` in the items store, a merge-reducer for INSERT/UPDATE/DELETE events, a `SyncStatus` pill component, and a subscribe-before-fetch lifecycle in ListPage with `visibilitychange`/`online` reconnect handlers.

The channel lifecycle, merge-reducer dedup logic, and stale-closure avoidance are largely sound. Two correctness bugs were found that can cause real data loss or silent state divergence in production. Four warnings cover robustness gaps that will manifest for real users.

---

## Critical Issues

### CR-01: `fetchInFlight` is module-level — blocks all subsequent fetches after a navigation or StrictMode remount

**File:** `src/stores/itemsStore.ts:9,255-257`

**Issue:** `fetchInFlight` is declared at module scope, not inside the store. Once `fetchItems` sets it `true`, it is only cleared in the `.finally()` callback. If the component unmounts (navigation away, StrictMode double-mount) while the fetch is in-flight, `finally()` still runs and resets the flag — that path is actually fine. However, the critical failure mode is: if the `SUBSCRIBED` callback fires, `fetchInFlight` is set to `true`, and then the `fetchItems` promise rejects with a thrown exception rather than returning `{ error }` (network error, Supabase client throws), the `.finally()` block **does still run**, so that specific case is also okay.

The real bug is subtler: `fetchInFlight` is shared across **all list IDs**. If a user navigates from list A to list B:
1. List A's `SUBSCRIBED` fires → `fetchInFlight = true`, `fetchItems('list-A')` begins.
2. React unmounts ListPage for list A, mounts ListPage for list B.
3. List B's `SUBSCRIBED` fires while list A's fetch is still running → guard sees `fetchInFlight === true` → **skips the initial fetch for list B entirely**.
4. List B renders with an empty item list until the user manually triggers a reconnect.

This is a silent data-visibility failure: User B opens a list, sees no items, doesn't know whether the list is empty or whether the fetch was skipped.

**Fix:** Scope the guard per-channel or per-listId, not at module level. The cleanest approach is a closure variable inside `subscribeToList`:

```ts
subscribeToList: (listId: string) => {
  const existing = get().channel
  if (existing) supabase.removeChannel(existing)

  set({ syncStatus: 'connecting' })
  let fetchInFlight = false   // <-- moved inside, scoped to this subscription

  const channel = supabase
    .channel(`items-${listId}`)
    .on('postgres_changes', { /* ... */ }, (payload) => { /* merge reducer */ })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        set({ syncStatus: 'live' })
        if (!fetchInFlight) {
          fetchInFlight = true
          get().fetchItems(listId).finally(() => { fetchInFlight = false })
        }
      } else {
        set({ syncStatus: 'reconnecting' })
      }
    })

  set({ channel })
},
```

Remove the module-level `let fetchInFlight = false` declaration on line 9.

---

### CR-02: `deleteItem` rollback appends to the **end** of the list — re-insert order is wrong

**File:** `src/stores/itemsStore.ts:142-144`

**Issue:** When `deleteItem` fails and rolls back, the restored item is appended to the end of the `items` array:

```ts
set((state) => ({ items: [...state.items, prev], error: 'Failed to delete item' }))
```

The items array is ordered by `created_at` ascending (as fetched). Appending `prev` to the end places an item that originally appeared in the middle of the list at the bottom. If the error resolves and the user retries, the visual list order is permanently corrupted for the session — the item appears at the wrong position until the next full re-fetch. For a grocery app where category grouping is derived from `items` order, this can also cause the item to appear in the wrong category section momentarily.

The same issue exists in `clearChecked` rollback (line 198-199): checked items are also appended to the end. That one is less severe because `clearChecked` is a bulk operation and a re-fetch normally follows, but the principle is identical.

**Fix:** Restore the item at its original index:

```ts
if (error) {
  set((state) => {
    const idx = state.items.findIndex((i) => i.id === id)
    const restored = [...state.items]
    if (idx === -1) {
      // Item was concurrently removed — just append
      restored.push(prev)
    } else {
      // This path shouldn't happen (item was optimistically removed above),
      // but if it does, re-insert at end
      restored.push(prev)
    }
    // Re-insert at original position by using the snapshot index
    // Better: track the original index before the optimistic removal
    return { items: restored, error: 'Failed to delete item' }
  })
}
```

More robustly, capture the original index before the optimistic removal:

```ts
deleteItem: async (id) => {
  const prevItems = get().items          // snapshot full array
  const prev = prevItems.find((i) => i.id === id)
  if (!prev) return

  set((state) => ({ items: state.items.filter((i) => i.id !== id) }))

  const { error } = await supabase.from('items').delete().eq('id', id)

  if (error) {
    // Restore using the full pre-deletion snapshot
    set({ items: prevItems, error: 'Failed to delete item' })
  }
},
```

---

## Warnings

### WR-01: `subscribeToList` cleans up the existing channel but never awaits the channel's close before opening a new one

**File:** `src/stores/itemsStore.ts:208-209`

**Issue:** `supabase.removeChannel(existing)` is called synchronously, but the Supabase JS client's `removeChannel` initiates an async unsubscription. The new channel is created on the very next line. If the old channel's WebSocket frame is still being sent, both channels may be alive briefly and the new `SUBSCRIBED` callback can fire while the old channel is still delivering events. On fast networks this window is sub-millisecond; on slow mobile connections it can be hundreds of milliseconds. During that window duplicate events could be processed (INSERT dedup guards against this, but UPDATE/DELETE have no dedup).

This is not catastrophic given the app's 2-user scope, but it is a correctness gap on the reconnect path.

**Fix:** Store the Promise returned by `removeChannel` (or check its resolved value) if the Supabase client exposes it, or set `syncStatus: 'connecting'` and delay the new channel creation by a microtask tick:

```ts
const existing = get().channel
if (existing) {
  await supabase.removeChannel(existing)   // returns Promise in supabase-js v2
}
```

Note: `subscribeToList` is currently `void`-returning. Changing to `async` is safe — callers in `ListPage` do not `await` it but the return value is discarded, so no call-site changes are needed.

---

### WR-02: `visibilitychange` handler calls `fetchItems` unconditionally — races with `fetchInFlight` guard only inside `subscribeToList`, not here

**File:** `src/pages/ListPage.tsx:101-104`

**Issue:** The `handleVisibility` and `handleOnline` handlers call `useItemsStore.getState().fetchItems(list!.id)` directly, bypassing the `fetchInFlight` guard that lives inside `subscribeToList`'s `SUBSCRIBED` callback. This means:

1. Tab becomes visible (`visibilitychange` fires).
2. Supabase Realtime reconnects and `SUBSCRIBED` fires within the same event loop batch.
3. Both `handleVisibility` and the `SUBSCRIBED` callback call `fetchItems` simultaneously.
4. Two concurrent `fetchItems` calls run; whichever resolves second wins and overwrites the first result in state. This is a read-read race and is unlikely to corrupt data, but it does generate double network traffic and can cause a brief flicker where `loading: true` is set twice.

The `fetchInFlight` guard comment in the store (line 253) explicitly says it prevents this, but the guard only applies to the `SUBSCRIBED` path — the event handler path is unprotected.

**Fix:** Apply the same `fetchInFlight` guard inside the event handlers (using the per-subscription-scoped variable from CR-01's fix), or funnel resync through a dedicated `resync()` action on the store that applies the guard:

```ts
// In the store:
resync: (listId: string) => {
  if (fetchInFlight) return
  fetchInFlight = true
  get().fetchItems(listId).finally(() => { fetchInFlight = false })
},

// In ListPage:
function handleVisibility() {
  if (document.visibilityState === 'visible') {
    useItemsStore.getState().resync(list!.id)
  }
}
```

---

### WR-03: `UPDATE` merge-reducer does not guard against a missing item — silently no-ops

**File:** `src/stores/itemsStore.ts:233-238`

**Issue:** The `UPDATE` branch maps over items and replaces the matching row by `id`. If the item is not found in the current state (e.g., it was optimistically deleted locally while an UPDATE arrived from the partner), `state.items.map(...)` returns the unchanged array with no error. The returning of the unchanged state is correct, but there is a subtle consequence: the updated item data is permanently discarded. If the optimistic delete later rolls back (CR-02 scenario), the item is restored to its **pre-update** state, not the updated state. This means a partner's edit is silently lost.

For a 2-user app this is a known acceptable trade-off (acknowledged in the prompt as intentionally out-of-scope for LWW). However the guard for `DELETE` explicitly handles the missing-id case with an early `return state` and a comment. The missing guard here is an inconsistency that could mislead future maintainers.

**Fix:** Add a comment or a defensive guard:

```ts
if (eventType === 'UPDATE') {
  const exists = state.items.some((i) => i.id === (newRow as Item).id)
  // No-op if item was optimistically removed locally — partner's edit is discarded.
  // Acceptable for 2-user app without LWW (intentional trade-off, see RESEARCH §Conflicts).
  if (!exists) return state
  return {
    items: state.items.map((i) =>
      i.id === (newRow as Item).id ? (newRow as Item) : i
    ),
  }
}
```

---

### WR-04: `unsubscribe` resets `syncStatus` to `'connecting'` — misleads the UI after intentional cleanup

**File:** `src/stores/itemsStore.ts:272-274`

**Issue:** When `unsubscribe()` is called on unmount (ListPage cleanup in `useEffect` return), `syncStatus` is set to `'connecting'`. If the store's state persists across route navigations (Zustand stores are module singletons), the `SyncStatus` pill will briefly show "Connecting…" on the home page or any other page that renders `SyncStatus` but is not inside a list view. This is a cosmetic issue but it can confuse users who see the status pill flicker on non-list pages.

More importantly: if the component re-mounts quickly (React StrictMode, fast route transitions), the `'connecting'` state set by `unsubscribe` could be read by the freshly mounting component before `subscribeToList` resets it, causing a flash of "Connecting…" that races with the next `SUBSCRIBED` callback.

**Fix:** Either reset `syncStatus` to a fourth state like `'idle'` (requires updating `SyncStatus.tsx` to handle it), or do not reset `syncStatus` in `unsubscribe` and instead rely on `subscribeToList` to reset it at the top:

```ts
unsubscribe: () => {
  const channel = get().channel
  if (channel) {
    supabase.removeChannel(channel)
    set({ channel: null })  // do NOT reset syncStatus here; subscribeToList owns it
  }
},
```

---

## Info

### IN-01: `fetchInFlight` guard test coverage is absent

**File:** `src/stores/itemsStore.test.ts`

**Issue:** There are no tests for the `fetchInFlight` guard behavior — specifically that a second `SUBSCRIBED` event does not trigger a second `fetchItems` call while the first is in-flight. Given that CR-01 identifies a real bug in this exact logic, the lack of a regression test means the bug could be reintroduced after the fix.

**Fix:** Add a test in the `subscribeToList` describe block:

```ts
it('fetchInFlight guard: does not call fetchItems a second time if SUBSCRIBED fires while a fetch is pending (SYNC-03)', async () => {
  let resolveFetch!: () => void
  const fetchSpy = vi.fn().mockImplementation(() => new Promise<void>((res) => { resolveFetch = res }))
  useItemsStore.setState({ fetchItems: fetchSpy })

  useItemsStore.getState().subscribeToList('list-sync')
  capturedSubscribeCb = getCapturedCb()
  capturedSubscribeCb!('SUBSCRIBED')   // first SUBSCRIBED — fetch starts
  capturedSubscribeCb!('SUBSCRIBED')   // second SUBSCRIBED — should be no-op

  expect(fetchSpy).toHaveBeenCalledTimes(1)
  resolveFetch()
})
```

---

### IN-02: `SyncStatus` test mock types `useItemsStore` as accepting only `{ syncStatus: string }` — will break if store shape is extended

**File:** `src/components/SyncStatus.test.tsx:7-9`

**Issue:** The mock narrows the store state parameter type to `{ syncStatus: string }` rather than the full `ItemsState`. This is a test-local simplification that works today, but if a future test in this file needs to assert on other state fields, TypeScript will reject the selector. Additionally, `string` is wider than the actual union `'connecting' | 'live' | 'reconnecting'` — a typo like `selector({ syncStatus: 'conecting' })` would pass TypeScript checks in the test but represent an impossible production state.

**Fix:** Import and use the actual state type:

```ts
import type { ItemsState } from '@/stores/itemsStore'

vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: vi.fn((selector: (s: ItemsState) => unknown) =>
    selector({ syncStatus: 'live' } as ItemsState)
  ),
}))
```

Or narrow to the literal union:

```ts
type SyncStatusState = { syncStatus: 'connecting' | 'live' | 'reconnecting' }
```

---

_Reviewed: 2026-05-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
