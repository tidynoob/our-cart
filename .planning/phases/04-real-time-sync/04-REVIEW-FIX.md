---
phase: 04-real-time-sync
fixed_at: 2026-05-26T15:57:00Z
review_path: .planning/phases/04-real-time-sync/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-05-26T15:57:00Z
**Source review:** .planning/phases/04-real-time-sync/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: addItem + Realtime INSERT race produces duplicate items in the UI

**Files modified:** `src/stores/itemsStore.ts`
**Commit:** 1854c86
**Applied fix:** Added a `pendingTempIds` Set to track optimistic temp IDs during the window between `addItem` call and HTTP response. The Realtime INSERT merge reducer now checks if an incoming server row matches a pending optimistic item by name, and replaces the temp item in-place instead of appending a duplicate. Temp IDs are cleaned up on both success and error paths.

### CR-02: Background re-fetch sets `loading: true`, causing the item list to vanish and reappear

**Files modified:** `src/stores/itemsStore.ts`
**Commit:** 2290650
**Applied fix:** Added a `{ background?: boolean }` option to `fetchItems`. When `background: true`, the function skips setting `loading: true`, preventing the list from disappearing during re-fetches. The SUBSCRIBED callback passes `{ background: true }` when items are already populated (screen wake, reconnect scenarios). Initial page load retains the default `background: false` behavior.

### WR-01: `inFlightListId` dedup guard suppresses needed fetch when prior same-list fetch fails

**Files modified:** `src/stores/itemsStore.ts`
**Commit:** e1a4884
**Applied fix:** Replaced the single `.finally()` handler with explicit `.then()` and `.catch()` handlers. On success, the guard is cleared normally. On failure (thrown exception), the guard is cleared immediately so subsequent SUBSCRIBED callbacks can trigger a fresh fetch instead of being silently suppressed.

### WR-02: `handleVisibility` calls `fetchItems` directly, bypassing the `inFlightListId` dedup guard

**Files modified:** `src/pages/ListPage.tsx`
**Commit:** db9ac97
**Applied fix:** Replaced the direct `fetchItems(list.id)` call in `handleVisibility` with `subscribeToList(list.id)`. This consolidates screen-wake recovery into the same path as online recovery, leveraging the existing `inFlightListId` dedup guard and preventing concurrent unguarded fetches when `visibilitychange` and `online` events fire in rapid succession.

### WR-03: Merge reducer UPDATE branch creates a new array reference even when no item matches

**Files modified:** `src/stores/itemsStore.ts`
**Commit:** 145a3e9
**Applied fix:** Added an early `return state` (same reference) when no local item matches the updated row's ID, mirroring the DELETE branch's defensive pattern. This avoids creating a new array reference and triggering unnecessary React re-renders on Realtime UPDATE events for locally-absent items.

### WR-04: `useEffect` dependency array includes `subscribeToList` and `unsubscribe` extracted via selector

**Files modified:** `src/pages/ListPage.tsx`
**Commit:** f12ff10
**Applied fix:** Removed `subscribeToList` and `unsubscribe` from component-level selectors and the `useEffect` dependency array. Both are now accessed via `useItemsStore.getState()` inside the effect body and cleanup function (matching the pattern already used by the event handlers). Dependency array reduced to `[list]` only. Also removed the now-unused selector declarations at the component level.

---

_Fixed: 2026-05-26T15:57:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
