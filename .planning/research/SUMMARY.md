# Project Research Summary

**Project:** Our Cart -- Shared Grocery List
**Domain:** Real-time collaborative list app, two-person household, no-auth link sharing, phone-first
**Researched:** 2026-05-24
**Confidence:** HIGH

## Executive Summary

Our Cart is a purpose-scoped real-time collaborative grocery list for a two-person household. The research consensus is clear: the product core value is instant, frictionless sync between two phones, and every architectural and feature decision should be evaluated against that single criterion. The recommended build approach is a React + Vite SPA backed entirely by Supabase -- handling both the Postgres database and the WebSocket broadcast layer -- deployed as a static bundle on Vercel. There is no backend server to build or host. The URL-embedded UUID is the access credential; no auth system is needed.

The dominant risk is real-time reliability in the actual use environment: a grocery store with patchy cellular, a locked phone screen between aisles, and one-handed tap interactions. All four research files converge on the same failure mode: silent WebSocket disconnection with no recovery path, which breaks the core promise of shared awareness. This must be designed in from day one -- connection state UI, on-reconnect re-fetch, and full-row touch targets -- not added as a polish pass. A secondary operational risk is Supabase free-tier project pausing after 7 days of inactivity, preventable with a 15-minute scheduled keep-alive.

The feature scope is intentionally tight and the research affirms it. The competitive landscape shows that complexity (multiple lists, meal planning, pantry inventory, barcode scanning) degrades the core use case for a two-person household. Build the six table-stakes features reliably, add the two low-cost differentiators (item notes, who-added-this), and stop. Validate the core loop on real phones in a real store before adding anything else.

---

## Key Findings

### Recommended Stack

The full stack runs with zero ongoing infrastructure cost. React 19 + Vite 8 is the right SPA foundation: no SSR complexity, HMR under 50ms, React 19 useOptimistic hook is the idiomatic primitive for instant-feedback mutations. Supabase JS 2.106 handles both Postgres and Realtime (WebSocket subscription to WAL changes, under 50ms broadcast latency). Tailwind v4 provides mobile-first utility styling. Zustand 5 handles minimal ephemeral UI state. nanoid generates URL-safe list IDs.

**Core technologies:**
- React 19 + Vite 8: SPA framework and build tool -- fastest dev loop, correct for real-time client-rendered app with no SEO requirements
- Supabase (supabase-js 2.106): Postgres + Realtime WebSockets -- single free-tier service; 200 concurrent connections (100x headroom for 2 users)
- Tailwind CSS v4: Mobile-first utility CSS -- CSS-first config, 5x faster builds than v3
- Zustand 5: Client state -- ~3KB, no boilerplate, holds optimistic state between mutation and Realtime confirmation
- nanoid 5: Share ID generation -- URL-friendly, cryptographically secure
- Vercel Hobby: Static hosting -- serves the Vite /dist bundle from CDN, always-on

**Key rejections with rationale:**
- Next.js: No SSR/SEO need; App Router is unjustified overhead for a pure SPA
- Firebase: Removed free Storage tier Feb 2026; NoSQL is less ergonomic for a structured list
- TanStack Query: Supabase push model eliminates the polling layer TanStack optimizes
- Redux: 10x boilerplate for a 2-user app; Zustand covers all state needs

### Expected Features

The research confirms the project scope is well-calibrated. No course correction needed.

**Must have (table stakes -- build first):**
- Add items with name, optional quantity, optional category -- fast entry is the primary measure
- Real-time sync via Supabase Realtime -- polling is not acceptable; this is the core value proposition
- Check off items -- stays visible, crossed out, not immediately removed
- Clear completed items -- two-step flow: check off during shopping, bulk clear when done; never auto-delete
- Share via link/code, no account required -- the shared UUID URL is the credential
- Phone-first layout -- large tap targets, one-handed interaction, tested on a physical device

**Should have for v1 (low build cost, meaningful value):**
- Item notes field -- one text input per item; eliminates the most common wrong-item trip
- Who-added-this indicator -- color or initials per item row; surfaces context without auth

**Defer -- validate need before building:**
- Item history / autocomplete -- backend complexity; validate whether recurring items are frequent enough
- Auto-sort by category -- only valuable if users reliably categorize items

**Never build (this project):**
- Multiple lists, user accounts/auth, recipe integration, pantry inventory, price tracking, barcode scanning, offline/PWA mode, aisle-layout mapping, push notifications, voice assistant integration

### Architecture Approach

The architecture is a three-layer system with no custom backend: a React SPA manages local UI state and Supabase Realtime subscriptions; Supabase owns the Postgres database and broadcasts WAL changes to subscribed clients via WebSocket; Vercel serves the static bundle from CDN. Writes go Client to PostgREST to Postgres; reads after initial load come Realtime to Client. The list ID UUID in the URL is the only credential -- it scopes all RLS policies, no auth table required.

**Major components:**
1. React Client Component (ListContainer) -- holds items array in state, manages Supabase Realtime subscription, applies optimistic updates via useOptimistic
2. Supabase Realtime Server -- Elixir/Phoenix process watches Postgres WAL, routes INSERT/UPDATE/DELETE events to the channel matching the list UUID; changes arrive within ~50ms
3. Postgres + RLS -- source of truth; lists and items tables with UUID primary keys; RLS policies gate all anon-role access by list_id; the UUID is 122 bits of entropy

**Patterns to follow:**
- Optimistic UI (React 19 useOptimistic): apply mutation locally before server confirms; roll back on failure
- Subscribe before fetch: open the Realtime channel, queue events, then fetch the initial snapshot and merge
- Single channel per list: one postgres_changes subscription filtered by list_id, unsubscribed on unmount

**Data model:**
- lists(id UUID PK, created_at) -- one row per shared list; the UUID IS the share token
- items(id UUID PK, list_id UUID FK, name TEXT, quantity TEXT, category TEXT, checked BOOLEAN, created_at) -- all grocery items

### Critical Pitfalls

1. **Silent WebSocket disconnection with no recovery** -- Mobile Safari drops WebSocket connections on screen lock without firing a close event; Chrome throttles background tabs. Prevention: connection-state UI using Supabase channel status callbacks; on reconnect, always re-fetch the full list from Postgres. Must be designed in during the real-time sync phase, not retrofitted.

2. **Fetch-then-subscribe gap (missing events on load)** -- Subscribing to Realtime after the initial fetch creates a race window where changes are silently dropped. Prevention: subscribe before fetching; queue events received during the fetch; merge onto the snapshot after fetch resolves.

3. **Supabase free-tier project pausing (7-day inactivity)** -- Supabase pauses free projects after 7 days of no API calls; 90-day pause means permanent deletion. Prevention: scheduled GitHub Actions keep-alive ping before go-live.

4. **RLS disabled on Supabase tables** -- Default for new tables is RLS off with full anon access. The anon key is visible in the JS bundle. Prevention: enable RLS on every table before writing any data; this is a Phase 1 task, not a retrofit.

5. **Touch targets too small for in-store use** -- Small checkboxes cause mis-taps one-handed. Prevention: minimum 44x44px tap targets; make the entire list item row the check-off tap target.

---

## Implications for Roadmap

Based on the dependency graph across all four research files, the natural phase structure is infrastructure-first, then the core real-time loop, then deployment hardening. PITFALLS.md explicitly calls out that RLS and UUID list IDs must be decided before any data is written, and that connection reliability must be built during the sync phase, not added later.

### Phase 1: Foundation -- Database, Supabase Client, Share Link

**Rationale:** Everything else depends on the data layer. RLS must be enabled before any data is written (Pitfall 4). The UUID list ID format must be decided before any links are generated (Pitfall 8). ARCHITECTURE.md build order puts schema and RLS first.
**Delivers:** Supabase project with lists and items tables, RLS policies enabled and tested, nanoid-generated UUID list IDs, shareable /list/[id] URL route, Vite + React + Supabase JS scaffolded and connecting to the database.
**Addresses:** Share via link (table stakes 5), no-account access model.
**Avoids:** Pitfall 4 (RLS disabled), Pitfall 8 (guessable list IDs).

### Phase 2: Core List Operations -- Add, Check Off, Clear

**Rationale:** CRUD correctness must be proven before wiring real-time on top of it. Building and testing mutations in isolation makes debugging unambiguous.
**Delivers:** Add item (name, optional quantity, optional category), check off item (stays visible, crossed out), clear completed items (confirmation step, not single-tap), phone-first list UI with full-row tap targets. Include item notes field -- low effort.
**Addresses:** Table stakes features 1, 3, 4.
**Avoids:** Pitfall 6 (small touch targets), Pitfall 7 (destructive clear without confirmation), Pitfall 10 (over-engineering before core loop is proven).

### Phase 3: Real-Time Sync -- Supabase Realtime Subscription

**Rationale:** Highest-complexity phase with the most pitfalls. Must be built after CRUD works. Connection reliability must be designed here, not as a retrofit.
**Delivers:** Supabase Realtime postgres_changes subscription for the list UUID channel; subscribe-before-fetch pattern; optimistic UI via useOptimistic; connection-state indicator (Syncing / Reconnecting / Offline); on-reconnect full re-fetch. Include who-added-this indicator.
**Addresses:** Table stakes feature 2 (real-time sync).
**Avoids:** Pitfall 1 (silent disconnection), Pitfall 2 (fetch/subscribe gap), Pitfall 5 (no visual sync status), Pitfall 9 (wrong Realtime mode).

### Phase 4: Deployment and Operational Reliability

**Rationale:** App is functionally complete after Phase 3. Phase 4 is the difference between works-in-development and usable-as-a-daily-tool. Supabase project pausing is an operations problem that must be solved before the app is used in a real store.
**Delivers:** Vercel deployment (Vite static build), GitHub Actions keep-alive ping, empty state UI, smoke test on physical iOS device with airplane mode toggling.
**Addresses:** Operational reliability.
**Avoids:** Pitfall 3 (Supabase project pausing), Pitfall 11 (empty state feels broken).

### Phase Ordering Rationale

- Phase 1 before Phase 2: Schema and RLS must exist before mutations can be written. UUID list ID format is a one-way decision.
- Phase 2 before Phase 3: CRUD correctness is a prerequisite for meaningful Realtime testing. Isolating each layer makes bugs unambiguous.
- Phase 3 is its own phase: The subscribe-before-fetch pattern, optimistic UI, connection-state tracking, and on-reconnect behavior are all interdependent and cannot be split without creating the exact retrofit problem PITFALLS.md warns about.
- Phase 4 is last but not optional: Supabase pausing will silently break the app within a week of going quiet during development.

### Research Flags

Phases with standard patterns (no additional research needed during planning):
- **Phase 1:** Supabase schema creation, RLS policy syntax, and Vite scaffolding are covered by official docs.
- **Phase 2:** Standard React form handling and CRUD mutations. No novel territory.
- **Phase 4:** Vercel static deploy and GitHub Actions cron jobs are commodity operations.

Phases that may benefit from targeted research during planning:
- **Phase 3:** The exact implementation of subscribe-before-fetch with Supabase JS client channel lifecycle (especially SUBSCRIBED callback timing) may warrant reading the Supabase Realtime JS client changelog. The useOptimistic + Supabase Realtime integration pattern is newer (React 19) and community examples are sparse.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major choices verified against official docs and current npm versions (2026-05-24). |
| Features | HIGH | Based on direct comparison of 5+ competing apps. Competitive landscape clearly maps to table stakes vs. differentiators. |
| Architecture | HIGH | All patterns sourced from Supabase official docs and React 19 official docs. Free-tier limits verified numerically. |
| Pitfalls | HIGH | Critical pitfalls sourced from documented real-world incidents and official Supabase platform docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **RLS policy exact syntax for no-auth list scoping:** ARCHITECTURE.md notes the RLS example needs refinement for list_id scoping. The exact pattern needs to be pinned during Phase 1 planning.
- **Who-added-this attribution without auth:** With no auth system, the likely approach is a client-generated persistent identifier stored in localStorage, but this was not fully specified in the research. Clarify during Phase 3 planning.
- **Item autocomplete feasibility:** Deferred from MVP. If validated, it requires an item_history table not in the current data model. Flag for a future phase.

---

## Sources

### Primary (HIGH confidence -- official documentation)
- Supabase Realtime Architecture: https://supabase.com/docs/guides/realtime/architecture
- Supabase Realtime Limits: https://supabase.com/docs/guides/realtime/limits
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- React useOptimistic: https://react.dev/reference/react/useOptimistic
- Vite 8 release: https://vite.dev/blog/announcing-vite8
- React 19 versions: https://react.dev/versions
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby

### Secondary (MEDIUM confidence -- community and comparison sources)
- SmartCart Family grocery app comparison: https://smartcartfamily.com/en/blog/grocery-apps-comparison
- GroceriesTracker best apps 2026: https://groceriestracker.com/blog/best-grocery-list-apps-2026
- Cupla blog: https://cupla.app/blog/the-top-grocery-list-apps-for-couples-families/
- supabase-pause-prevention GitHub repo: https://github.com/travisvn/supabase-pause-prevention
- Supabase WebSocket connection management: https://eastondev.com/blog/en/posts/dev/supabase-realtime-practice/
- Touch targets -- Nielsen Norman Group: https://www.nngroup.com/articles/touch-target-size/
- Supabase security/RLS misconfigurations: https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster

### Tertiary (supporting/contextual)
- OurGroceries User Guide: https://www.ourgroceries.com/user-guide
- The Easy List: https://www.theeasylist.com/guides/how-to-create-shared-shopping-list-online
- Safari dropping WebSocket on inactivity: https://github.com/socketio/socket.io/issues/2924

---
*Research completed: 2026-05-24*
*Ready for roadmap: yes*
