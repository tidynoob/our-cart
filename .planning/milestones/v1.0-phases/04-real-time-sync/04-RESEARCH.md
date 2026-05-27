# Phase 4: Real-Time Sync - Research

**Researched:** 2026-05-26
**Domain:** Supabase Realtime — Postgres Changes, WebSocket lifecycle, React/Zustand integration
**Confidence:** HIGH (core API verified via official source code + docs); MEDIUM (reconnect edge-case behavior cross-verified via multiple community sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Supabase **Postgres Changes** (`postgres_changes`) on `items` table, filtered `list_id=eq.{listId}`. Broadcast rejected.
- **D-02:** Subscribe to all event types (`*`) — INSERT, UPDATE, DELETE. `clearChecked` bulk deletes surface as multiple DELETE events handled by the same per-row remove logic.
- **D-03:** Idempotent-by-`id` merge: INSERT → upsert (skip if id present), UPDATE → replace matching row, DELETE → remove matching id. Own echoed events are no-ops.
- **D-04:** No LWW/CRDT conflict layer. Server event is truth; rare simultaneous-edit resolves to last Postgres commit.
- **D-05:** Subscribe-before-fetch ordering — channel opens first, then `fetchItems` runs.
- **D-06:** On channel status `SUBSCRIBED`, re-run `fetchItems` to backfill any missed events.
- **D-07:** Also resync on `document.visibilitychange` → visible and `window` `online` event (Mobile Safari screen-lock belt-and-suspenders).
- **D-08:** Minimal status pill: **Live** (green) when `SUBSCRIBED`; **Reconnecting…** (amber) on `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` / connecting.
- **D-09:** Channel lives in `itemsStore` via `subscribeToList(listId)` / `unsubscribe()` actions + `syncStatus` field. `ListPage` drives lifecycle via `useEffect`.

### Claude's Discretion
- `syncStatus` shape: string union `'live' | 'reconnecting' | 'connecting'`
- Indicator component: new `SyncStatus` component vs inline JSX
- Realtime enablement check: confirm whether Phase 1 added `items` to publication (research finds it did NOT)
- Debounce/guard on `fetchItems` when multiple resync triggers fire near-simultaneously
- Incoming UPDATE clobbering an in-flight optimistic row: let server event win (acceptable at 2 users)

### Deferred Ideas (OUT OF SCOPE)
- Presence / "partner is viewing now" (OPS-02)
- Supabase keep-alive to prevent 7-day project pause (OPS-01)
- Last-write-wins / conflict UI for simultaneous edits
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | Changes (add, edit, check off, delete, clear) appear on both devices within 2 seconds | Postgres Changes subscription with `list_id` filter; idempotent merge reducer in itemsStore |
| SYNC-02 | App reconnects and re-fetches after WebSocket disconnection (e.g., screen lock on mobile) | `SUBSCRIBED` callback + `visibilitychange`/`online` events; `worker: true` option; re-fetch in `subscribeToList` |
| SYNC-03 | Connection status indicator shows whether sync is active | `syncStatus` field in itemsStore driven by `REALTIME_SUBSCRIBE_STATES` enum values |
</phase_requirements>

---

## Summary

Phase 4 wires Supabase Realtime Postgres Changes into the existing Zustand `itemsStore` and `ListPage` lifecycle. The architecture is straightforward: one filtered channel per list, owned by the store, with an idempotent merge reducer that treats own-write echoes as no-ops. The main complexity is reliability — particularly the mobile Safari screen-lock reconnect path and the `supabase_realtime` publication requirement that Phase 1 did not address.

The Supabase JS client (`@supabase/realtime-js`) uses Phoenix Channel semantics internally. The `.subscribe()` callback receives four status strings from `REALTIME_SUBSCRIBE_STATES`: `SUBSCRIBED`, `TIMED_OUT`, `CLOSED`, `CHANNEL_ERROR`. The D-08 three-state indicator maps cleanly onto these. Reconnection behavior is automatic but imperfect: the SDK uses stepped backoff (1s, 2s, 5s, 10s) and will internally rejoin, but `SUBSCRIBED` may not reliably re-fire after every auto-reconnect. The safest pattern is D-07 belt-and-suspenders: `visibilitychange`/`online` events trigger a refetch independent of the channel status callback.

**Primary recommendation:** Implement `subscribeToList(listId)` in `itemsStore` to create the channel, call the merge reducer on incoming events, update `syncStatus`, and call `fetchItems` on SUBSCRIBED + on `visibilitychange`/`online`. The `supabase_realtime` publication **must** be updated via a manual dashboard step or SQL before any events fire — this is the single highest-risk prerequisite.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Realtime event subscription | Client (Supabase WS) | Zustand store | Channel created client-side via supabase-js; merge reducer lives in store alongside items array |
| Merge/dedup of incoming events | Zustand store | — | Must be colocated with `items` state to avoid stale-closure issues |
| Reconnection / resync trigger | Client (event listeners) | Zustand store action | `visibilitychange` + `online` events fire in browser; store action executes the refetch |
| Sync status display | React component | Zustand store | Component reads `syncStatus` from store; store writes it from channel callback |
| Channel lifecycle (mount/unmount) | ListPage useEffect | Zustand store | Page drives start/stop; store owns the channel reference |
| Realtime publication enablement | Supabase DB (one-time) | — | `ALTER PUBLICATION supabase_realtime ADD TABLE items` — manual SQL step |

---

## Standard Stack

No new packages are required for this phase. All necessary libraries are already installed.

### Existing Libraries Used
| Library | Installed Version | Purpose | Role in Phase 4 |
|---------|------------------|---------|-----------------|
| `@supabase/supabase-js` | `^2.106.1` | Supabase client | `supabase.channel().on('postgres_changes', ...).subscribe()` |
| `zustand` | `^5.0.13` | State management | `subscribeToList`, `unsubscribe`, `syncStatus` field, merge reducer |
| `react` | `^19.2.6` | UI framework | `useEffect` for channel lifecycle; `SyncStatus` component |

**No new npm installs required for this phase.** [VERIFIED: package.json]

---

## Package Legitimacy Audit

No new packages are installed in this phase. The audit section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
ListPage useEffect (list loaded)
    │
    ▼
itemsStore.subscribeToList(listId)
    │
    ├─── 1. supabase.channel('items-{listId}')
    │         .on('postgres_changes', { event:'*', schema:'public',
    │              table:'items', filter:'list_id=eq.{listId}' }, mergeReducer)
    │         .subscribe(onStatusChange)
    │
    ├─── 2. fetchItems(listId)           [subscribe-before-fetch, D-05]
    │
    └─── onStatusChange(status)
              │
              ├── SUBSCRIBED  → set syncStatus='live', fetchItems(listId)  [D-06]
              ├── CHANNEL_ERROR → set syncStatus='reconnecting'
              ├── TIMED_OUT   → set syncStatus='reconnecting'
              └── CLOSED      → set syncStatus='reconnecting'

ListPage also attaches (in useEffect):
    document: 'visibilitychange' → if visible, fetchItems(listId)   [D-07]
    window:   'online'           → fetchItems(listId)                [D-07]

Incoming postgres_changes event
    │
    ▼
mergeReducer(payload)
    ├── eventType=INSERT → upsert by id (no-op if id exists)
    ├── eventType=UPDATE → replace item matching payload.new.id
    └── eventType=DELETE → remove item matching payload.old.id

ListPage unmount:
    itemsStore.unsubscribe()          → supabase.removeChannel(channel)
    document.removeEventListener(...)
    window.removeEventListener(...)
```

### Recommended Project Structure

```
src/
├── stores/
│   └── itemsStore.ts          # Add: subscribeToList, unsubscribe, syncStatus, mergeReducer
├── components/
│   └── SyncStatus.tsx         # New: status pill reading syncStatus from store
└── pages/
    └── ListPage.tsx            # Add: subscribeToList lifecycle + SyncStatus mount
```

### Pattern 1: Filtered Postgres Changes Subscription

**What:** Subscribe to all mutations on `items` filtered to a specific `list_id`.

**When to use:** On mount when `list.id` is known.

```typescript
// Source: supabase.com/docs/guides/realtime/postgres-changes [CITED]
// Source: RealtimeChannel.ts REALTIME_SUBSCRIBE_STATES enum [VERIFIED: github.com/supabase/realtime-js]
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js'

const channel = supabase
  .channel(`items-${listId}`)          // unique per list; never use 'realtime'
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'items',
      filter: `list_id=eq.${listId}`,
    },
    (payload) => mergeReducer(payload)
  )
  .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
      set({ syncStatus: 'live' })
      get().fetchItems(listId)          // re-fetch on every SUBSCRIBED (D-06)
    } else if (
      status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
      status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
      status === REALTIME_SUBSCRIBE_STATES.CLOSED
    ) {
      set({ syncStatus: 'reconnecting' })
    }
  })
```

**Note on REALTIME_SUBSCRIBE_STATES import:** The enum is exported from `@supabase/realtime-js`, which is a transitive dependency of `@supabase/supabase-js`. You can also use string literals (`'SUBSCRIBED'`, `'CHANNEL_ERROR'`, `'TIMED_OUT'`, `'CLOSED'`) if the import causes issues — both work. [ASSUMED: import path may need verification against installed version]

### Pattern 2: Idempotent Merge Reducer

**What:** Pure reducer function that applies an incoming event to the items array idempotently.

**When to use:** As the callback in `.on('postgres_changes', ..., mergeReducer)`.

```typescript
// Source: CONTEXT.md D-03 + Supabase payload type from realtime-js [CITED]
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js'
import type { Item } from '@/types/item'

function mergeReducer(payload: RealtimePostgresChangesPayload<Item>) {
  const { eventType, new: newRow, old: oldRow } = payload
  set((state) => {
    if (eventType === 'INSERT') {
      // Upsert: skip if id already present (own-write echo guard)
      const alreadyPresent = state.items.some((i) => i.id === (newRow as Item).id)
      if (alreadyPresent) return state
      return { items: [...state.items, newRow as Item] }
    }
    if (eventType === 'UPDATE') {
      return {
        items: state.items.map((i) =>
          i.id === (newRow as Item).id ? (newRow as Item) : i
        ),
      }
    }
    if (eventType === 'DELETE') {
      // payload.old contains only the primary key when RLS is enabled
      // (even with replica identity full) — always key DELETE off payload.old.id
      const deletedId = (oldRow as Pick<Item, 'id'>).id
      return { items: state.items.filter((i) => i.id !== deletedId) }
    }
    return state
  })
}
```

### Pattern 3: Channel Lifecycle in ListPage useEffect

**What:** Subscribe-before-fetch wiring + visibilitychange/online belt-and-suspenders.

**When to use:** In the existing `useEffect` that fires when `list` loads (lines 84-93 of ListPage.tsx).

```typescript
// Source: CONTEXT.md D-05, D-07; supabase.com/docs/guides/realtime/getting_started [CITED]
useEffect(() => {
  if (!list) return

  // D-05: subscribe before fetch
  const { subscribeToList, unsubscribe, fetchItems } = useItemsStore.getState()
  subscribeToList(list.id)   // opens channel, calls fetchItems internally on SUBSCRIBED

  // D-07: belt-and-suspenders for mobile Safari screen-lock
  function handleVisibility() {
    if (document.visibilityState === 'visible') {
      fetchItems(list.id)
    }
  }
  function handleOnline() {
    fetchItems(list.id)
  }

  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('online', handleOnline)

  return () => {
    unsubscribe()
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('online', handleOnline)
  }
}, [list])
```

**StrictMode note:** In React `<StrictMode>`, `useEffect` runs twice in development (mount → unmount → mount). The cleanup `unsubscribe()` + `supabase.removeChannel(channel)` must be called in the cleanup function. On the second mount, a new channel is created with a fresh subscription. This is safe as long as each mount creates a new channel object. Do NOT store channel refs in module scope — store them in the Zustand state or a `useRef`. [MEDIUM confidence — verified against multiple community sources]

### Pattern 4: Cleanup via removeChannel

**What:** The correct teardown method is `supabase.removeChannel(channel)`, not `channel.unsubscribe()` alone.

```typescript
// Source: supabase.com/docs/guides/realtime/getting_started [CITED]
// supabase.removeChannel() unsubscribes AND removes the channel from the client registry,
// preventing duplicate event handlers after remount.
unsubscribe: () => {
  const channel = get().channel
  if (channel) {
    supabase.removeChannel(channel)
    set({ channel: null, syncStatus: 'connecting' })
  }
}
```

### Anti-Patterns to Avoid

- **Broadcast instead of Postgres Changes:** Rejected (D-01). Would require manual emit on every mutation — double write paths, drift risk.
- **Subscribe after fetch:** Events between fetch start and subscribe complete are lost — subscribe first (D-05).
- **Only relying on SUBSCRIBED for resync:** SUBSCRIBED may not reliably re-fire after every auto-reconnect (see Pitfall 3). Use D-07 visibilitychange/online as backup.
- **`channel.unsubscribe()` without `removeChannel`:** Leaves channel in client registry; causes duplicate event handlers after StrictMode remount or component re-render.
- **Clobbering all items on every event:** The merge reducer applies per-row changes; never replace the entire array from an event payload.
- **Naming channel 'realtime':** Reserved string, causes silent failure.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection to Supabase | Custom WebSocket client | `supabase.channel().subscribe()` | supabase-js handles auth headers, heartbeat, Phoenix protocol, stepped backoff reconnect |
| Realtime event filtering | Client-side event filtering loop | `filter: 'list_id=eq.{id}'` in `.on()` config | Server-side filter — only matching rows arrive; no wasted bandwidth |
| Reconnection backoff | Custom timer/interval | supabase-js built-in stepped backoff (1s, 2s, 5s, 10s) | Already implemented; adding custom reconnect on top creates double-reconnect storms |
| Idempotency key | Complex vector clocks | `id`-keyed upsert in merge reducer | Supabase UUIDs are stable primary keys; simpler solution is correct for 2-user app |

**Key insight:** The supabase-js realtime layer is a Phoenix Channels client. All protocol details (heartbeat, reconnect, join/leave handshake) are abstracted. The only application-level code needed is the merge reducer and the lifecycle wiring.

---

## Realtime Enablement: Critical Prerequisite

### Phase 1 Did NOT Enable Realtime for `items`

**Finding:** The Phase 1 schema SQL (`01-01-PLAN.md` Task 2) created `lists` and `items` tables and enabled RLS, but did **not** include `ALTER PUBLICATION supabase_realtime ADD TABLE items`. [VERIFIED: 01-01-PLAN.md SQL confirmed absent]

**Impact:** Without this step, no Postgres Changes events will fire. The subscription will appear to succeed (returns `SUBSCRIBED`), but the callback is never called for mutations. This is the #1 silent failure mode.

**Required SQL (one-time, run in Supabase SQL Editor):**
```sql
alter publication supabase_realtime add table items;
```

Alternatively, via Dashboard: Project → Database → Replication → `supabase_realtime` publication → toggle `items` table ON.

**Note:** `lists` table does not need to be added — Phase 4 only subscribes to `items` mutations.

### RLS Interaction with Realtime

**Finding:** When RLS is enabled on a table and it is in the `supabase_realtime` publication, Supabase Realtime checks RLS policies before broadcasting each event to a subscriber. [CITED: supabase.com/docs/guides/realtime/postgres-changes]

**For this app:** The existing `anon_select_items` policy (`using (exists (select 1 from lists where lists.id = items.list_id))`) allows anon users to SELECT any item that belongs to a valid list. The realtime stream uses the same check, so any item mutation on the subscribed `list_id` will pass through. No RLS changes are needed. [MEDIUM confidence — relies on RLS policy equivalence between REST and Realtime]

**Critical DELETE caveat:** RLS policies are **not** applied to DELETE events in Realtime. Supabase cannot verify post-deletion whether the subscriber was allowed to see the deleted row. As a result, DELETE events are broadcast regardless of RLS (this is by design). For a 2-person private list this is fine — both users are legitimately subscribed to the same list. [CITED: supabase.com/docs/guides/realtime/postgres-changes]

---

## DELETE Payload: Primary Key Only

**Finding:** When RLS is enabled AND `replica identity` is set to `full`, the `old` record in a DELETE payload contains **only the primary key(s)** — not the full row. Without `replica identity full`, `old` also contains only the primary key. [CITED: supabase.com/docs/guides/realtime/postgres-changes + GitHub discussion #12471]

**The `payload.old` type:** `Partial<T> | {}` — may be an empty object or contain only `id`.

**Implication for the merge reducer:** DELETE events must key off `payload.old.id` only. Never attempt to use other fields from `payload.old` in a DELETE handler — they may not be present.

**Type-safe access:**
```typescript
// payload.old is typed as Partial<Item> | {} — cast defensively:
const deletedId = (payload.old as { id?: string }).id
if (deletedId) {
  set((state) => ({ items: state.items.filter((i) => i.id !== deletedId) }))
}
```

---

## Payload Shape Reference

```typescript
// Source: RealtimePostgresChangesPayload from @supabase/realtime-js
// [VERIFIED: github.com/supabase/realtime-js RealtimeChannel.ts]
{
  schema: 'public',
  table: 'items',
  commit_timestamp: '2026-05-26T10:00:00.000Z',
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  new: Item | {},    // populated for INSERT and UPDATE; {} for DELETE
  old: Partial<Item> | {},   // populated for UPDATE (full row if replica identity full);
                             // for DELETE contains only primary key(s)
  errors: string[]
}
```

---

## Reconnect / Resync Behavior (SYNC-02 — Highest Risk)

### What supabase-js Does Automatically

The SDK uses stepped backoff reconnection: 1s → 2s → 5s → 10s (then stays at 10s). [VERIFIED: RealtimeClient.ts RECONNECT_INTERVALS]

The underlying Phoenix Channel issues an internal `_rejoin()` on socket reconnect.

### Critical Finding: SUBSCRIBED May NOT Re-fire on Auto-Reconnect

Source code analysis of `RealtimeChannel.ts` shows that `SUBSCRIBED` is delivered once when the initial join succeeds. The internal `_rejoin()` path used after socket reconnect does not guarantee re-triggering the subscribe callback with `SUBSCRIBED`. Community reports confirm this: "reconnection occurs but postgres_changes events are no longer received." [MEDIUM confidence — cross-referenced realtime-js source + community discussions #27513, #213]

**This means D-06 alone (refetch on SUBSCRIBED) is necessary but not sufficient for SYNC-02.** D-07 (visibilitychange/online) is the reliable resync path for the mobile screen-lock case.

### Mobile Safari Screen Lock

Mobile Safari sends the browser to background when the screen locks, throttling JavaScript timers. The Realtime heartbeat (default interval: 25 seconds) fails, and the server closes the connection after missing heartbeats. On wake-up, `document.visibilityState` transitions to `'visible'` and `window` emits `'online'` (if network reconnects). [CITED: Supabase troubleshooting docs + eastondev.com blog]

**The `worker: true` option** offloads heartbeat to a Web Worker, making it more resilient to browser timer throttling. In testing this improved background heartbeat success rate from 63% to 96%. However, it does not eliminate the problem on Safari. [CITED: eastondev.com/blog/en/posts/dev/20260512-supabase-realtime-practice/]

**Decision for this app:** Given the 2-user, $0-budget, app-is-open-when-shopping use case, `worker: true` is a valuable addition to `createClient` options. It is a single-line addition to `src/lib/supabase.ts`. The planner should include this as an optional but recommended enhancement in a Wave 1 task.

```typescript
// src/lib/supabase.ts — enhanced createClient for background resilience
// Source: Supabase troubleshooting docs [CITED]
export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    worker: true,   // heartbeat via Web Worker — survives browser timer throttling
  },
})
```

**Note:** `worker: true` requires a supported browser (Chrome 80+, Firefox 114+, Safari 15+). On unsupported browsers it falls back gracefully. [ASSUMED — based on Web Worker support tables, not verified against supabase-js source]

### Resync Guard (Debounce)

When the screen wakes, `visibilitychange` → visible, `online`, and potentially `SUBSCRIBED` may fire within milliseconds of each other. Without a guard, `fetchItems` runs 2-3 times in quick succession. A simple in-flight flag or a 300ms debounce prevents redundant DB queries. [ASSUMED — derived from event sequencing knowledge; acceptable for 2-user app]

```typescript
// Simple in-flight guard (no library needed):
let fetchInFlight = false
function guardedFetch(listId: string) {
  if (fetchInFlight) return
  fetchInFlight = true
  get().fetchItems(listId).finally(() => { fetchInFlight = false })
}
```

---

## Echo / Dedup Correctness

### Own-Write Echo: INSERT

When device A calls `addItem()`:
1. `addItem` optimistically inserts with a temp nanoid id (e.g., `tmp_XYZ`)
2. Supabase INSERT resolves → `addItem` replaces `tmp_XYZ` with the real DB row (e.g., `uuid-ABC`)
3. Postgres Changes fires an INSERT event with `payload.new.id = 'uuid-ABC'`
4. Merge reducer: checks if `'uuid-ABC'` already exists in `state.items` — it does (replaced in step 2) → **no-op**

The timing is: step 2 always completes before step 3 fires (the DB write commits before the replication event is dispatched). The id-keyed upsert guard is therefore a reliable dedup for own-write INSERT echoes. [MEDIUM confidence — relies on Postgres commit-before-WAL ordering, which is guaranteed]

### Own-Write Echo: UPDATE and DELETE

For `updateItem`, `deleteItem`, `toggleChecked`, and `clearChecked`, the optimistic state change happens before the DB call. By the time the realtime event arrives, the local state already matches the server row (or the row is already absent for DELETE). The merge reducer's id-keyed replace/remove is idempotent. [HIGH confidence]

### Race: In-flight Optimistic UPDATE vs Incoming UPDATE

Scenario: User A edits name → optimistic state is "Bread"; in-flight Supabase PATCH; User B edits same item name → Realtime UPDATE event arrives with "Croissant". The merge reducer replaces the row with "Croissant". A's PATCH then resolves and has already succeeded on the server (the DB has "Bread" committed). Another Realtime UPDATE event fires for A's PATCH.

**Outcome:** B's edit wins momentarily, then A's wins on the next event. The server reflects A's commit. This is acceptable per D-04: "server state from the realtime event is treated as truth." No additional dedup layer is needed. [HIGH confidence — D-04 explicitly documents this decision]

---

## Common Pitfalls

### Pitfall 1: Missing Publication — Silent Failure
**What goes wrong:** Events never arrive; subscription shows `SUBSCRIBED` but callback never fires.
**Why it happens:** `items` table is not in the `supabase_realtime` publication. The channel joins successfully but Postgres does not send WAL events.
**How to avoid:** Run `alter publication supabase_realtime add table items;` in SQL Editor before testing. Verify by checking Dashboard → Database → Replication → supabase_realtime.
**Warning signs:** Channel status is `SUBSCRIBED`, mutations work (REST reads/writes fine), but second device never sees changes.

### Pitfall 2: DELETE Payload Missing Full Row
**What goes wrong:** Merge reducer tries to use `payload.old.name` or other fields — they are `undefined`.
**Why it happens:** RLS-enabled tables with default replica identity only include the primary key in `payload.old` for DELETE events.
**How to avoid:** Only key off `payload.old.id` in the DELETE branch. Never use other fields.
**Warning signs:** TypeScript type `Partial<Item> | {}` is a signal — treat `old` as potentially empty except for `id`.

### Pitfall 3: SUBSCRIBED Not Re-firing After Reconnect
**What goes wrong:** After a mobile screen-lock/wake cycle, the channel auto-reconnects (SDK backoff), but `SUBSCRIBED` does not fire again — no refetch happens, app shows stale data.
**Why it happens:** The internal `_rejoin()` path in Phoenix Channels does not reliably re-invoke the subscribe callback.
**How to avoid:** D-07 belt-and-suspenders: `visibilitychange` → visible and `window` `online` both call `fetchItems`. These are the primary resync triggers for the screen-lock case.
**Warning signs:** User wakes screen, items don't update; sync indicator shows "Live" (channel thinks it's connected) but new items from the partner don't appear.

### Pitfall 4: React StrictMode Double-Subscribe
**What goes wrong:** In development, `useEffect` runs twice. Two channels are created with the same name, causing duplicate merge events (every mutation appears twice in the UI).
**Why it happens:** StrictMode mount → unmount → remount. If cleanup doesn't call `removeChannel`, the first channel is still active.
**How to avoid:** Always call `supabase.removeChannel(channel)` in the useEffect cleanup, not just `channel.unsubscribe()`. `removeChannel` deregisters the channel from the client's registry.
**Warning signs:** Items appear duplicated in development mode; console shows two channel subscriptions; only happens in dev (`<StrictMode>`).

### Pitfall 5: Channel Name Collision
**What goes wrong:** If two `useEffect` runs (or component remounts) create channels with the same name and the first isn't cleaned up, events route to both callbacks.
**Why it happens:** `supabase.channel('items-{listId}')` with the same name re-uses or conflicts with an existing channel depending on client state.
**How to avoid:** Include `listId` in the channel name (already in D-09 pattern). Ensure cleanup runs `removeChannel` before creating a new one.
**Warning signs:** Same as Pitfall 4 — duplicate events.

### Pitfall 6: Calling fetchItems Before Channel is Registered
**What goes wrong:** Events that fire between the start of `fetchItems` and the channel completing its join are lost.
**Why it happens:** Subscribe-after-fetch ordering.
**How to avoid:** D-05 is the solution — open channel first, then fetch. The SUBSCRIBED callback fires after the channel join completes, and `fetchItems` inside it captures any gap.
**Warning signs:** Items occasionally appear on refresh but not in real-time; only happens under load or slow connections.

### Pitfall 7: Using the Reserved Channel Name 'realtime'
**What goes wrong:** The subscription fails silently.
**Why it happens:** 'realtime' is reserved by the Supabase Realtime protocol.
**How to avoid:** Name channels `items-{listId}` or similar.

---

## Code Examples

### Full subscribeToList implementation sketch

```typescript
// Source: CONTEXT.md D-01 through D-09; realtime-js source [CITED + VERIFIED]
subscribeToList: (listId: string) => {
  // Clean up any existing channel before creating a new one
  const existing = get().channel
  if (existing) supabase.removeChannel(existing)

  set({ syncStatus: 'connecting' })

  const channel = supabase
    .channel(`items-${listId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `list_id=eq.${listId}`,
      },
      (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload
        set((state) => {
          if (eventType === 'INSERT') {
            const id = (newRow as Item).id
            if (state.items.some((i) => i.id === id)) return state
            return { items: [...state.items, newRow as Item] }
          }
          if (eventType === 'UPDATE') {
            return {
              items: state.items.map((i) =>
                i.id === (newRow as Item).id ? (newRow as Item) : i
              ),
            }
          }
          if (eventType === 'DELETE') {
            const deletedId = (oldRow as { id?: string }).id
            if (!deletedId) return state
            return { items: state.items.filter((i) => i.id !== deletedId) }
          }
          return state
        })
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        set({ syncStatus: 'live' })
        get().fetchItems(listId)
      } else {
        set({ syncStatus: 'reconnecting' })
      }
    })

  set({ channel })
},

unsubscribe: () => {
  const channel = get().channel
  if (channel) {
    supabase.removeChannel(channel)
    set({ channel: null, syncStatus: 'connecting' })
  }
},
```

### SyncStatus component sketch

```typescript
// Three-state indicator driven by syncStatus from itemsStore
function SyncStatus() {
  const syncStatus = useItemsStore((s) => s.syncStatus)
  if (syncStatus === 'live') {
    return <span className="flex items-center gap-1 text-xs text-green-600">
      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
      Live
    </span>
  }
  return <span className="flex items-center gap-1 text-xs text-amber-600">
    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
    {syncStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
  </span>
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `anon` key in supabase-js | `publishable` key (sb_publishable_xxx) | ~2024 | Already using correct key — no change needed |
| `channel.unsubscribe()` for cleanup | `supabase.removeChannel(channel)` | supabase-js v2 | Use removeChannel to avoid registry leaks |
| `for all tables` publication | Per-table publication toggle | Always | Must explicitly add `items` to publication |

**Deprecated/outdated:**
- `supabase.from('table').on('*', cb).subscribe()` — v1 API. Phase 4 uses the v2 `.channel().on('postgres_changes', ...).subscribe()` pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `REALTIME_SUBSCRIBE_STATES` enum is importable from `@supabase/realtime-js` as a named export in v2.106 | Standard Stack / Code Examples | Import path may differ; string literals work as fallback |
| A2 | `RealtimePostgresChangesPayload<T>` type is importable from `@supabase/realtime-js` | Code Examples | Type import may need adjustment; `any` works as fallback for typing |
| A3 | `worker: true` on `createClient` realtime options is supported in supabase-js 2.106 | Reconnect section | If not supported, option is ignored (graceful degradation); verify by checking createClient type signature |
| A4 | SUBSCRIBED does not reliably re-fire after auto-reconnect (making D-07 essential) | Reconnect section | If SUBSCRIBED does re-fire reliably, D-07 is belt-and-suspenders (still safe, just redundant) |
| A5 | 300ms debounce is sufficient to deduplicate simultaneous visibilitychange + online + SUBSCRIBED | Reconnect section | Too short: redundant fetches; too long: user waits unnecessarily. Low risk at 2 users. |

---

## Open Questions (RESOLVED)

> All three carry implementation-level fallbacks in Plan 04-02 / verified at the Plan 04-03 smoke test — none block execution.
> - Q1 → use string-literal status values (`'SUBSCRIBED'` etc.) if the named import is awkward.
> - Q2 → add `worker: true` with a compile-time fallback (drop it if TS errors; D-07 still covers reconnect).
> - Q3 → verified by the two-device smoke test in Plan 04-03 Task 3.

1. **Does supabase-js 2.106.1 export `REALTIME_SUBSCRIBE_STATES` and `RealtimePostgresChangesPayload` as named exports?**
   - What we know: These types exist in the realtime-js source at the confirmed GitHub URL.
   - What's unclear: The exact public re-export path in supabase-js 2.106.1's index.
   - Recommendation: In Wave 0 task, verify with `import { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js'` and fall back to string literals if needed.

2. **Is `worker: true` realtime option present in supabase-js 2.106.1?**
   - What we know: `worker` is in the RealtimeClientOptions interface per source analysis.
   - What's unclear: When this was added relative to 2.106.1's release date.
   - Recommendation: Include as optional enhancement; if TypeScript errors on it, skip (the fallback D-07 approach still covers the use case).

3. **Does the `anon_select_items` RLS policy from Phase 1 cover the Realtime stream?**
   - What we know: Supabase documentation states "every change event must be checked to see if the subscribed user has access" using the same RLS policies.
   - What's unclear: Whether the anon role policy scoped to `list_id` works correctly for the Realtime checker (it should, since the channel filter provides the `list_id`).
   - Recommendation: Test with a real device pair during UAT — if events don't arrive, check Realtime logs in Supabase Dashboard.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @supabase/supabase-js | Realtime channel | Yes | ^2.106.1 | — |
| Supabase project (Realtime enabled) | SYNC-01/02 | Yes (from Phase 1) | Free tier | — |
| `supabase_realtime` publication w/ `items` | SYNC-01 | Needs manual SQL step | — | Run `alter publication supabase_realtime add table items` |
| Browser WebSocket support | All realtime | Yes | Native in all target browsers | — |
| Web Worker support (worker: true) | SYNC-02 enhancement | Yes (Safari 15+, Chrome 80+, Firefox 114+) | Graceful degradation if missing | D-07 visibilitychange/online fallback |

**Missing dependencies with no fallback:**
- `supabase_realtime` publication must include `items` table — this is a blocking prerequisite. No code-level fallback exists.

**Missing dependencies with fallback:**
- `worker: true` — gracefully degrades to main-thread heartbeat; D-07 covers the reconnect case.

---

## Validation Architecture

Nyquist validation enabled (`workflow.nyquist_validation: true` in config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.3 + Testing Library React 16 |
| Config file | `vitest.config.ts` (exists, jsdom environment) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | INSERT echo: own-write INSERT is a no-op in merge reducer | unit | `npx vitest run src/stores/itemsStore.test.ts -t "mergeReducer"` | No — Wave 0 gap |
| SYNC-01 | INSERT from partner: new item added to store | unit | same | No — Wave 0 gap |
| SYNC-01 | UPDATE from partner: item fields replaced in store | unit | same | No — Wave 0 gap |
| SYNC-01 | DELETE from partner: item removed from store by id | unit | same | No — Wave 0 gap |
| SYNC-01 | DELETE payload only has id: reducer handles `payload.old` with only id | unit | same | No — Wave 0 gap |
| SYNC-01 | clearChecked DELETE events: multiple DELETE events remove correct items | unit | same | No — Wave 0 gap |
| SYNC-02 | fetchItems called on SUBSCRIBED status | unit | `npx vitest run src/stores/itemsStore.test.ts -t "subscribeToList"` | No — Wave 0 gap |
| SYNC-02 | fetchItems called on visibilitychange→visible | unit | `npx vitest run src/pages/ListPage.test.tsx -t "visibilitychange"` | No — Wave 0 gap |
| SYNC-02 | fetchItems called on window online event | unit | `npx vitest run src/pages/ListPage.test.tsx -t "online"` | No — Wave 0 gap |
| SYNC-02 | Screen-lock → wake reconnect shows updated items | manual/integration | Manual test: lock phone, partner adds item, unlock, verify item appears | — |
| SYNC-02 | Reconnect after network drop shows updated items | manual/integration | Manual test: toggle airplane mode, partner adds item, re-enable, verify | — |
| SYNC-03 | syncStatus transitions: connecting → live on SUBSCRIBED | unit | `npx vitest run src/stores/itemsStore.test.ts -t "syncStatus"` | No — Wave 0 gap |
| SYNC-03 | syncStatus → reconnecting on CHANNEL_ERROR | unit | same | No — Wave 0 gap |
| SYNC-03 | SyncStatus pill renders correct text/color per syncStatus | unit | `npx vitest run src/components/SyncStatus.test.tsx` | No — Wave 0 gap |
| SYNC-01 | 2-second latency criterion | manual/integration | Manual test: two browsers open same list; time item appearance after add | — |

### Mocking Strategy for Unit Tests

The Supabase channel is not a real network connection in unit tests. Mock it by extending the existing `vi.mock('@/lib/supabase', ...)` pattern in `itemsStore.test.ts`:

```typescript
// Extend existing mock to support channel API:
const mockSubscribeCb = vi.fn()
const mockChannelOn = vi.fn().mockReturnThis()
const mockChannelSubscribe = vi.fn().mockImplementation((cb) => {
  mockSubscribeCb.mockImplementation(cb)
  return {}  // channel object
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: ...,  // existing mock
    channel: vi.fn().mockReturnValue({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    }),
    removeChannel: vi.fn(),
  },
}))

// In test: trigger status callback directly:
mockSubscribeCb('SUBSCRIBED')
// Then assert fetchItems was called and syncStatus === 'live'
```

The merge reducer itself is a pure function (it calls `set()` but can be extracted and tested as a pure transform). Ideal unit test: call the reducer function directly with a mock payload, assert the resulting state.

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual 2-device test completed

### Wave 0 Gaps

- [ ] `src/stores/itemsStore.test.ts` — extend to cover `subscribeToList`, `unsubscribe`, `syncStatus`, and merge reducer (INSERT, UPDATE, DELETE, echo dedup, DELETE-only-id)
- [ ] `src/pages/ListPage.test.tsx` — add tests for `visibilitychange` and `online` event handlers calling `fetchItems`
- [ ] `src/components/SyncStatus.test.tsx` — new file; test three state renders (live, connecting, reconnecting)

*(Existing test infrastructure covers all other phases — no framework install needed.)*

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` per config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth is share-code URL; no changes in Phase 4 |
| V3 Session Management | No | No session tokens; anon key + RLS |
| V4 Access Control | Yes | RLS on `items` table gates Realtime stream; `anon_select_items` policy must remain in place |
| V5 Input Validation | No | Phase 4 reads events; no new user input paths |
| V6 Cryptography | No | No crypto operations added |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Eavesdropping on Realtime stream | Information Disclosure | RLS policy checks each event; anon subscriber only receives items from their list_id |
| Cross-list Realtime leakage | Information Disclosure | Channel filter `list_id=eq.{id}` + RLS ensures subscriber only sees own list's events |
| DELETE event broadcasts to all anon users | Information Disclosure | By design (Supabase cannot apply RLS to DELETE); acceptable because both users legitimately own the list |
| Stale subscription after list access is revoked | Elevation of Privilege | Not applicable — no access revocation mechanism exists (share-code model); out of scope |
| Channel name guessing | Information Disclosure | Channel name includes `listId` (UUID); UUID is not guessable; publishable key is scoped to anon role + RLS |

---

## Sources

### Primary (HIGH confidence)
- `github.com/supabase/realtime-js/blob/master/src/RealtimeChannel.ts` — `REALTIME_SUBSCRIBE_STATES` enum, subscribe callback signature, channel state machine
- `github.com/supabase/realtime-js/blob/master/src/RealtimeClient.ts` — `RealtimeClientOptions` interface including `worker`, `heartbeatIntervalMs`, `RECONNECT_INTERVALS`
- `supabase.com/docs/guides/realtime/postgres-changes` — subscription API, filter syntax, publication setup, RLS interaction, DELETE payload behavior

### Secondary (MEDIUM confidence)
- `supabase.com/docs/guides/realtime/getting_started` — `removeChannel` cleanup pattern in React useEffect
- `eastondev.com/blog/en/posts/dev/20260512-supabase-realtime-practice/` — status values (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED), reconnection backoff, `worker: true` effectiveness data
- `github.com/orgs/supabase/discussions/27513` — SUBSCRIBED may not re-fire on auto-reconnect; CHANNEL_ERROR → TIMED_OUT → CLOSED behavior
- `github.com/supabase/realtime-js/issues/169` — React StrictMode double-subscribe; CLOSED signal on first mount in dev

### Tertiary (LOW confidence)
- `github.com/orgs/supabase/discussions/5641` — subscribe-before-fetch pattern community endorsement (older v1 API examples but pattern is current)
- `github.com/orgs/supabase/discussions/19387` — visibilitychange as primary reconnect trigger for idle sessions

---

## Metadata

**Confidence breakdown:**
- Subscription API (channel, filter, subscribe): HIGH — verified against realtime-js source
- Payload shape (eventType, new, old): HIGH — type definition from realtime-js
- DELETE payload primary-key-only: HIGH — cited from official docs
- Status values (SUBSCRIBED/CHANNEL_ERROR/TIMED_OUT/CLOSED): HIGH — verified from RealtimeChannel.ts enum
- SUBSCRIBED re-fires on reconnect: MEDIUM — source analysis + community; may vary by supabase-js version
- worker: true option: MEDIUM — verified in source interface; effectiveness data from blog
- RLS allowing realtime stream: MEDIUM — relies on documented policy equivalence
- Publication requirement (items not in publication after Phase 1): HIGH — verified by reading 01-01-PLAN.md SQL

**Research date:** 2026-05-26
**Valid until:** 2026-08-26 (stable API; 90 days for Supabase free tier behavior)
