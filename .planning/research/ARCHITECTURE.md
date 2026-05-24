# Architecture Patterns

**Domain:** Real-time shared grocery list (two-person, no auth, phone-first)
**Researched:** 2026-05-24
**Confidence:** HIGH (verified against Supabase official docs + multiple architectural sources)

---

## Recommended Architecture

A three-layer architecture: a React frontend that manages local UI state, a Supabase backend that owns the database and broadcasts changes, and a thin Next.js API layer for anything that must not run client-side. There is no separate WebSocket server to operate — Supabase Realtime handles the pub/sub infrastructure entirely.

```
Browser (Phone/Desktop)
  └── Next.js App (React)
        ├── Client Components  ← hold real-time state, subscriptions
        └── Server Components  ← initial data fetch (SSR), layout shell

        ↕ HTTPS / WebSocket (over Supabase JS client)

Supabase (BaaS)
  ├── PostgreSQL          ← source of truth
  ├── Realtime Server     ← Elixir/Phoenix, watches WAL, pushes changes
  ├── PostgREST API       ← REST reads/writes via anon key
  └── Row Level Security  ← access control per list_id
```

The frontend never talks directly to a separate backend service. Supabase's anon key is the only credential the browser holds, and RLS policies on the `lists` and `items` tables enforce that the anon role can only read/write rows belonging to the list identified in the URL.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Next.js Server Components** | Render initial HTML shell, fetch list data for SSR on first load | Supabase PostgREST (server-side) |
| **React Client Components** | Hold list state, render items, handle user interactions, manage Supabase Realtime subscription | Supabase JS client (browser) |
| **Supabase PostgREST** | Accepts REST mutations (insert, update, delete) from the browser via anon key | PostgreSQL |
| **Supabase Realtime Server** | Watches PostgreSQL WAL, broadcasts INSERT/UPDATE/DELETE events to subscribed clients | PostgreSQL (logical replication), Browser WebSocket |
| **PostgreSQL** | Durable source of truth: lists, items, checked state | Supabase Realtime (WAL), PostgREST |
| **RLS Policies** | Gate all reads/writes by `list_id`; anon role can access only their list's rows | PostgreSQL (enforced at query time) |

---

## Data Flow

### Flow 1 — Initial Page Load (User opens share link)

```
1. Browser hits /list/[list_id]
2. Next.js Server Component fetches list + items from Supabase (server-side)
3. Server renders HTML with items pre-populated (no loading spinner)
4. Hydration: Client Component takes over, opens Realtime channel for this list_id
5. User sees list immediately; real-time subscription is now live
```

### Flow 2 — User Adds an Item

```
1. User types item, taps Add
2. Client Component applies optimistic update (item appears instantly in local state)
3. Supabase JS client sends INSERT to PostgREST API
4. PostgreSQL writes the row → WAL entry created
5. Supabase Realtime reads WAL, routes INSERT event to all subscribers of this channel
6. The other user's browser receives the event, React state updates, item appears
7. If the INSERT failed: optimistic state is rolled back, error shown
```

### Flow 3 — User Checks Off an Item

```
1. User taps checkbox
2. Optimistic update: item crossed out locally immediately
3. Supabase JS client sends UPDATE (checked = true) to PostgREST
4. WAL → Realtime → other user's browser receives UPDATE event
5. Both views now show item as checked
```

### Flow 4 — Clear Checked Items

```
1. User taps "Clear checked"
2. Client Component sends DELETE (WHERE checked = true AND list_id = X)
3. Each deleted row fires a DELETE event through Realtime
4. Both clients remove checked items from state
```

The directional rule: **writes always go Client → PostgREST → PostgreSQL**. **Reads after initial load always come Realtime → Client** (not polling). The client never re-fetches the full list after initial load — it maintains state by applying incremental Realtime events.

---

## Data Model

```sql
-- One row per shared list (created once, accessed forever via share URL)
CREATE TABLE lists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- All grocery items belong to a list
CREATE TABLE items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID REFERENCES lists(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  quantity   TEXT,           -- "2 lbs", "1 dozen" — free text, not a number
  category   TEXT,           -- simple grouping: "Produce", "Dairy", etc.
  checked    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

The `list_id` UUID in the URL IS the access token. No auth table needed. The URL is the password.

### RLS Policy (access control without auth)

```sql
-- Enable RLS on both tables
ALTER TABLE lists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE items  ENABLE ROW LEVEL SECURITY;

-- Anyone with the anon key can read/write their specific list
-- The list_id comes from the client request; RLS enforces it server-side
CREATE POLICY "anon can access own list"
  ON items FOR ALL
  TO anon
  USING (true);           -- Refined: scope to list_id passed via request context
```

Note: For a two-person private app, the security model is "obscurity by UUID." The 122-bit UUID is not guessable. This is acceptable for the stated constraints (private household use, no sensitive data). A full auth system is explicitly out of scope.

---

## Patterns to Follow

### Pattern 1: Optimistic UI Updates

Apply the state change locally before the server confirms it. Revert on failure. This is essential for the "faster than a paper list" feel on mobile with variable cell signal.

React 19's `useOptimistic` hook is the idiomatic implementation. For each mutation (add, check, delete), the sequence is: update optimistic state → send to Supabase → on error, rollback + show toast.

### Pattern 2: Server Component Shell, Client Component Leaves

The page layout, navigation chrome, and initial list render are Server Components (faster first paint, no JS bundle cost). The live-updating list itself is a Client Component because it needs `useState`, `useEffect` for the Realtime subscription, and `useOptimistic` for mutations.

Keep the "use client" boundary as far down the component tree as possible. The `<ListContainer>` component should be a Client Component; the `<PageLayout>` wrapping it does not need to be.

### Pattern 3: Single Realtime Channel Per List

Subscribe to one channel scoped to the list's UUID. Listen for all `INSERT`, `UPDATE`, `DELETE` events on the `items` table filtered by `list_id`. Apply events as patches to local state rather than re-fetching the full list.

```typescript
// Pattern: subscribe once on mount, unsubscribe on unmount
const channel = supabase
  .channel(`list-${listId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'items',
    filter: `list_id=eq.${listId}`,
  }, (payload) => applyEvent(payload))
  .subscribe();

return () => supabase.removeChannel(channel);
```

### Pattern 4: Presence for "Other Person Is Here" Indicator (Optional, Later)

Supabase Realtime's Presence feature can show whether the other person currently has the list open. This is a free-tier-compatible feature (Presence messages: 20/sec limit, well within budget for 2 users). Defer to a later phase — it is not needed for core sync functionality.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Polling Instead of Realtime Subscription

**What:** Refetching the full item list on an interval (e.g., every 5 seconds).
**Why bad:** Introduces visible latency, wastes bandwidth on mobile, burns Supabase free-tier request quota, feels laggy compared to a paper list. The "instant sync" requirement makes polling a non-starter.
**Instead:** Supabase Realtime subscription (WebSocket, zero polling).

### Anti-Pattern 2: Re-fetching After Every Mutation

**What:** After adding an item, call `GET /items` to refresh the list.
**Why bad:** Creates a flash of stale content, doubles network requests, and races with the Realtime event (which would have updated the UI anyway).
**Instead:** Apply the mutation to local state optimistically. The Realtime event from the other user's action also updates state — these are the only two triggers needed.

### Anti-Pattern 3: Storing list_id in a Cookie or Session

**What:** Persisting which list a user "belongs to" in a server-side session.
**Why bad:** Requires server state, complicates the stateless BaaS model, adds a session backend that does not exist.
**Instead:** The list_id lives entirely in the URL. Both users bookmark or share the URL. The URL IS the session.

### Anti-Pattern 4: Normalized Client State with a Redux-Like Store

**What:** A complex client-side state tree with selectors, actions, reducers.
**Why bad:** Massive overkill for a single list of items. Adds hundreds of lines of boilerplate for no benefit.
**Instead:** `useState` for the items array in the `<ListContainer>` Client Component. Realtime events and mutations patch this array directly.

---

## Suggested Build Order

Dependencies between components drive this order. Each layer depends on the one below.

```
1. Database schema + RLS
   (items, lists tables; anon access policies)
   Nothing else can be built without a data layer.

2. Supabase client configuration
   (JS client initialized with project URL + anon key)
   Required by both read and real-time layers.

3. Core CRUD mutations
   (add item, check item, delete checked items via PostgREST)
   Build and test writes before wiring real-time.

4. Initial data fetch (SSR)
   (Server Component loads list on first render)
   Proves the data model is correct before adding complexity.

5. Realtime subscription
   (Client Component subscribes, applies incremental events)
   Wire after CRUD works — subscription is useless without data.

6. Optimistic UI
   (Wrap mutations in useOptimistic; rollback on failure)
   Add last — makes the app feel fast once correctness is proven.

7. Share link / URL routing
   (Generate and share /list/[uuid] URL)
   Can be done early (step 1) or last — not dependent on real-time.
```

---

## Scalability Considerations

This app is explicitly sized for 2 concurrent users. The architecture does not need to scale. But for reference:

| Concern | At 2 users (target) | At 200 users (free tier ceiling) | Notes |
|---------|---------------------|----------------------------------|-------|
| Realtime connections | 2 WebSockets per list | 200 concurrent connections (free tier max) | Far within limits |
| Database | Single PostgreSQL instance | Same — Supabase free tier handles it | No concern |
| Messages/sec | ~1 per interaction | 100/sec Supabase limit | Not reachable with 2 users |
| Vercel functions | Zero (no custom API routes needed) | Same | Supabase client runs in browser |

Supabase free tier limits that apply to this project:
- 200 peak concurrent WebSocket connections (we use 2)
- 100 messages/second throughput (we use <1/second)
- 100 channels per connection (we use 1)
- 256 KB max broadcast payload (a grocery item is ~200 bytes)

None of these limits are remotely reachable for a two-person app.

---

## Sources

- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture) — official docs, confirmed Elixir/Phoenix + WAL-based design
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — official docs, free tier: 200 connections, 100 msg/sec
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — official docs, anon role + RLS policy pattern
- [WebSockets vs SSE vs Polling — RxDB](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html) — transport comparison
- [React useOptimistic](https://react.dev/reference/react/useOptimistic) — official React 19 docs, optimistic UI hook
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — official Next.js docs, component boundary patterns
- [UUIDs for public share links](https://medium.com/lightrail/prevent-business-intelligence-leaks-by-using-uuids-instead-of-database-ids-on-urls-and-in-apis-17f15669fd2e) — UUID-based access pattern rationale
