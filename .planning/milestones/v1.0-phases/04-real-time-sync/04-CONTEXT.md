# Phase 4: Real-Time Sync - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Mode:** --auto (decisions auto-selected to recommended defaults; review before planning)

<domain>
## Phase Boundary

This phase layers live cross-device sync on top of the proven optimistic CRUD from Phases 2–3. When either device mutates an item (add, edit, check, uncheck, delete, or clear), the change appears on the other device within 2 seconds. After a WebSocket drop (e.g., mobile screen lock), the app auto-reconnects and re-fetches current list state so nothing is missed. A connection status indicator tells the user whether sync is live or reconnecting.

Requirements: SYNC-01, SYNC-02, SYNC-03.

**Out of scope:** presence/"partner is viewing" (OPS-02, v2), Supabase keep-alive against 7-day pause (OPS-01, v2), offline/PWA queueing (explicitly out of scope), mobile polish/autocomplete (Phase 5). No schema changes — items table and RLS already support all mutations.

</domain>

<decisions>
## Implementation Decisions

### Realtime Transport (SYNC-01)
- **D-01:** Use Supabase **Postgres Changes** (`postgres_changes`) subscribed to the `items` table, filtered `list_id=eq.{listId}`. The database is already the single source of truth — every mutation goes through `supabase-js` writes — so Postgres Changes requires zero extra publish code. Broadcast was rejected: it would force a manual emit on every mutation in `itemsStore`, doubling the write paths and creating drift risk for a 2-user app that gains nothing from it.
- **D-02:** Subscribe to all event types (`INSERT`, `UPDATE`, `DELETE`) on the filtered channel. `clearChecked` (bulk delete) surfaces as multiple `DELETE` events — handled by the same per-row remove logic.

### Echo / Merge Reconciliation (SYNC-01)
- **D-03:** Realtime events reconcile into the store **idempotently by `id`**: `INSERT` → upsert (skip if id already present), `UPDATE` → replace the matching row, `DELETE` → remove the matching id. Because the originating device already applied the change optimistically, its own echoed event becomes a no-op — no duplicates, no flicker.
- **D-04:** No last-write-wins conflict resolution layer. For a 2-person list, server state from the realtime event is treated as truth; the rare simultaneous-edit case resolves to whichever write Postgres committed last, which the next event reflects. Keeping this simple is deliberate (avoid CRDT/version-vector complexity the app doesn't need).

### Reconnection & Resync (SYNC-02)
- **D-05:** **Subscribe-before-fetch** ordering (carried forward — locked Phase-4 decision in STATE.md): open the channel first, then call `fetchItems`, so no event fired between fetch and subscribe is lost.
- **D-06:** On channel status `SUBSCRIBED` (fires on initial connect AND after `supabase-js` auto-reconnect), re-run `fetchItems` to backfill any events missed while the socket was down. This is the core SYNC-02 mechanism.
- **D-07:** Also trigger a resync on `document.visibilitychange` → visible and the `window` `online` event. Mobile Safari silently kills the WebSocket on screen lock; these events catch the wake-up case even if the socket reconnect is slow.

### Connection Status Indicator (SYNC-03)
- **D-08:** A minimal status pill near the list header (top of the list view). Three states derived from channel status: **Live** (green dot) when `SUBSCRIBED`; **Reconnecting…** (amber) on `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` / connecting. Phone-first: small, non-intrusive, never blocks the add-item flow.

### Subscription Ownership / Lifecycle
- **D-09:** The channel lives in `itemsStore` via `subscribeToList(listId)` / `unsubscribe()` actions, plus a `syncStatus` field the indicator reads. Keeps merge logic colocated with `items` state. `ListPage` stays a thin lifecycle driver — starts the subscription in a `useEffect` when the list loads, tears it down on unmount — matching the existing split (store owns data, ListPage owns ephemeral UI).

### Claude's Discretion
- **`syncStatus` shape:** enum/string union (`'live' | 'reconnecting' | 'connecting'`) vs richer object — planner decides; just needs to drive the three indicator states.
- **Indicator component:** new small `SyncStatus` component vs inline JSX in `ListPage` header — planner decides.
- **Realtime enablement check:** the `items` table must be added to the `supabase_realtime` publication (Postgres Changes requires it). Researcher/planner confirms whether this was enabled in Phase 1 schema setup or needs a migration/dashboard step.
- **Debounce of resync:** if `SUBSCRIBED` + `visibilitychange` + `online` all fire near-simultaneously on wake, a light debounce/guard on `fetchItems` may be warranted — planner decides.
- **Optimistic-in-flight vs incoming event race:** planner decides whether an incoming `UPDATE` should clobber a row that has an unconfirmed local optimistic change (low risk at 2 users; acceptable to let server event win).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value (real-time sync), $0-budget / 2-user constraints, mobile-first
- `.planning/REQUIREMENTS.md` — SYNC-01, SYNC-02, SYNC-03 (the requirements for this phase)
- `.planning/ROADMAP.md` §Phase 4 — Goal ("within 2 seconds, including after reconnection") and success criteria
- `.planning/STATE.md` §Accumulated Context — locked decisions: "Subscribe-before-fetch pattern required for Realtime (Phase 4)", "Mobile Safari WebSocket reconnection handling must be designed in Phase 4, not added later"

### Prior Phase
- `.planning/phases/03-shopping-flow/03-CONTEXT.md` — store-owns-data / ListPage-owns-ephemeral-UI split; optimistic mutation + rollback + `error` pattern
- `.planning/phases/01-foundation/01-01-PLAN.md` §Task 2 — items table SQL + RLS; confirm whether `items` is in the `supabase_realtime` publication

### Technology
- `CLAUDE.md` §Technology Stack — Supabase Realtime (200 concurrent / 2M messages free tier), React 19, Vite 8, Zustand
- Supabase Realtime Postgres Changes docs: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase Realtime Broadcast docs (for the rejected-alternative rationale): https://supabase.com/docs/guides/realtime/broadcast

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/itemsStore.ts` — Zustand store with optimistic CRUD (`addItem`/`updateItem`/`deleteItem`/`toggleChecked`/`clearChecked`), per-item rollback, and `error` field. Add `subscribeToList(listId)`, `unsubscribe()`, a realtime merge reducer, and a `syncStatus` field here. `Item` type fully defined in `src/types/item.ts`.
- `src/lib/supabase.ts` — single `supabase` client (`createClient`). The realtime channel is created from this client; no new client needed.
- `src/pages/ListPage.tsx` — already fetches items in a `useEffect` keyed on `list` (lines 84–93). This is where subscribe-before-fetch wiring and channel cleanup go. Header area (line ~198, `<h1>{list.name}</h1>`) is where the status indicator mounts. Existing `itemsError` + Retry block (lines 219–230) coexists with sync status.

### Established Patterns
- Store owns server data + mutation logic; `ListPage` owns ephemeral UI state and drives lifecycle via `useEffect` (Phase 2/3 review decision).
- Optimistic update + `id`-keyed reconciliation already present (`addItem` replaces temp `tempId` row with the real DB row by id) — realtime merge follows the same id-keyed model.
- `error`-state + Retry-refetch recovery is the precedent for surfacing a degraded sync state.

### Integration Points
- `itemsStore` ← new realtime channel writes into the same `items` array the UI already renders; merge reducer must be id-idempotent to absorb own-write echoes.
- `ListPage` `useEffect` (list-load) — call `subscribeToList(list.id)` then `fetchItems(list.id)` (subscribe-before-fetch), return cleanup calling `unsubscribe()`.
- `ListPage` header — mount the sync status indicator reading `syncStatus`.
- Supabase `items` table — must be in the `supabase_realtime` publication for Postgres Changes to fire (verify in planning).

</code_context>

<specifics>
## Specific Ideas

- "Within 2 seconds" is the hard acceptance bar (ROADMAP success criterion 1) — Postgres Changes on Supabase free tier comfortably meets this for 2 users.
- The screen-lock → reconnect → re-fetch path (SYNC-02) is the highest-risk behavior and the explicit reason this was designed into Phase 4 rather than retrofitted (per STATE.md locked decision). Plan should make it directly testable.
- Indicator must never compete with the add-item flow for attention — it's reassurance, not a control.

</specifics>

<deferred>
## Deferred Ideas

- **Presence / "partner is viewing now" (OPS-02)** — v2; Supabase Realtime Presence channel, separate from data sync.
- **Supabase keep-alive to prevent 7-day project pause (OPS-01)** — v2; operational concern, not sync correctness.
- **Last-write-wins / conflict UI for simultaneous edits** — not needed for 2 trusted users; revisit only if multi-list or larger groups ever enter scope (currently out of scope).

</deferred>

---

*Phase: 4-Real-Time Sync*
*Context gathered: 2026-05-26*
