# Phase 4: Real-Time Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 4-Real-Time Sync
**Mode:** --auto (no interactive prompts; recommended option auto-selected per area)
**Areas discussed:** Realtime transport, Echo/merge reconciliation, Reconnection & resync, Connection status indicator, Subscription lifecycle

---

## Realtime Transport (SYNC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres Changes on `items` (filter `list_id`) | DB is source of truth; zero extra publish code | ✓ |
| Broadcast | Manual emit on every mutation; client-to-client | |

**Auto choice:** Postgres Changes (recommended default)
**Notes:** All mutations already go through `supabase-js` DB writes, so Postgres Changes needs no publish path. Broadcast would double the write paths and risk drift.

---

## Echo / Merge Reconciliation (SYNC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent by `id` (INSERT upsert / UPDATE replace / DELETE remove) | Own optimistic write makes the echoed event a no-op | ✓ |
| Refetch-on-every-event | Simpler but chatty; misses the <2s/efficiency bar | |
| LWW with version vectors | Conflict resolution the 2-user app doesn't need | |

**Auto choice:** Idempotent by id (recommended default)
**Notes:** Matches the existing id-keyed reconciliation in `addItem` (temp-id → real-row swap). No conflict layer for 2 trusted users.

---

## Reconnection & Resync (SYNC-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Subscribe-before-fetch + re-fetch on SUBSCRIBED + visibilitychange/online | Backfills missed events on reconnect and screen-lock wake | ✓ |
| Socket auto-reconnect only | Relies on supabase-js; misses events fired while down | |

**Auto choice:** Subscribe-before-fetch + resync triggers (recommended default)
**Notes:** Carries forward the locked STATE.md decision (subscribe-before-fetch + mobile Safari reconnect designed in, not retrofitted).

---

## Connection Status Indicator (SYNC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Live/Reconnecting pill at list header | Phone-first, non-intrusive reassurance | ✓ |
| Full-width banner | Too heavy; competes with add-item flow | |
| Toast on disconnect only | No persistent "is sync live?" answer | |

**Auto choice:** Minimal status pill (recommended default)
**Notes:** Three states from channel status — Live (green) / Reconnecting (amber) / connecting.

---

## Subscription Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Channel in `itemsStore` (subscribe/unsubscribe + syncStatus); ListPage drives useEffect | Colocates merge with state; matches store/UI split | ✓ |
| Channel in ListPage useEffect | Splits merge logic from the store it mutates | |

**Auto choice:** Store-owned channel (recommended default)
**Notes:** Store owns data, ListPage owns ephemeral UI — established Phase 2/3 pattern.

---

## Claude's Discretion

- `syncStatus` shape (string union vs object)
- `SyncStatus` component vs inline header JSX
- Whether `items` is already in the `supabase_realtime` publication, or a migration/dashboard step is needed
- Debounce/guard on resync when SUBSCRIBED + visibilitychange + online fire together on wake
- Whether an incoming UPDATE should clobber an in-flight optimistic row (low risk at 2 users)

## Deferred Ideas

- Presence / "partner is viewing" (OPS-02) — v2
- Supabase keep-alive vs 7-day pause (OPS-01) — v2
- Last-write-wins / conflict UI — not needed for 2 trusted users
