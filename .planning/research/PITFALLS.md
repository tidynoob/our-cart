# Domain Pitfalls: Real-Time Shared Grocery List

**Domain:** Two-person real-time collaborative list, no-auth shared-link access, phone-first, Supabase free tier
**Researched:** 2026-05-24

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or the app being unusable in the real scenario it was built for.

---

### Pitfall 1: Silent WebSocket Disconnection With No Recovery

**What goes wrong:** The WebSocket connection drops — due to a network blip, the phone screen locking, or Safari's aggressive tab throttling — and the frontend has no idea. The person at the store keeps checking off items while the connection is dead. None of those updates propagate. The partner at home sees a stale list. Items get double-bought.

**Why it happens:** WebSocket close events are not always fired by the browser or OS. Mobile Safari is particularly aggressive: it drops WebSocket connections when the screen locks or the user switches apps, without firing a close event that the client can react to. Chrome on Android throttles WebSocket heartbeats in background tabs, which causes the server to consider the client dead while the client still thinks it's connected.

**Consequences:** Silent data loss for the at-store user. Stale list for the at-home user. The core value proposition — "nothing gets missed or double-bought" — is broken.

**Prevention:**
- Implement explicit connection-state tracking in the UI: "Syncing", "Reconnecting", "Offline".
- Use Supabase's channel status callbacks (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`) to detect disconnection and trigger visual feedback immediately.
- On reconnect, always re-fetch the current list from the database (not just replay realtime events) to fill any gap.
- Do not rely solely on WebSocket events for updates — on reconnect, issue a full GET of the list state.

**Warning signs:**
- No visible sync status indicator in the UI.
- Tests only performed on desktop Chrome with a stable connection.
- Reconnect logic not tested by toggling airplane mode on a physical iPhone.

**Phase:** Address in the core real-time sync phase, before any other feature work. This is the most important reliability concern.

---

### Pitfall 2: The "Fetch Then Subscribe" Gap (Missing Events on Load)

**What goes wrong:** The app loads, fetches the current list items via a REST query, then subscribes to realtime changes. If another user makes a change in the window between the fetch completing and the subscription activating, that change is silently missed. The UI shows a stale state and will not self-correct until the next change event arrives.

**Why it happens:** There is an inherent race condition between the initial data load (point-in-time snapshot) and the start of the realtime stream. This gap is typically 100-500ms but can be longer on slow mobile connections.

**Consequences:** One user's list shows an item that was already checked off by the other. Confusion, potential double-purchase.

**Prevention:**
- Subscribe to the realtime channel *before* issuing the initial fetch.
- Queue any realtime events received during the fetch.
- After the fetch resolves, merge queued events on top of the fetched snapshot.
- Alternatively: after the subscription is confirmed `SUBSCRIBED`, perform the initial fetch. Any event that fires during the fetch can be applied idempotently on top.

**Warning signs:** Initial data load and subscription setup happen sequentially (subscribe called in a `.then()` or `await` after the fetch returns).

**Phase:** Core real-time sync phase. Must be designed correctly from the start; retrofitting is messy.

---

### Pitfall 3: Supabase Free Tier Project Pausing (7-Day Inactivity)

**What goes wrong:** Supabase pauses free tier projects after 7 days of inactivity. If Mitch and his wife go on holiday or simply don't use the app for a week, the next time they open it the database is paused, causing 404s or connection timeouts. If the project stays paused for 90 days, it is permanently deleted.

**Why it happens:** Supabase free tier resource conservation policy. "Inactivity" means no API calls to the project.

**Consequences:** App appears broken. Manual intervention required (visit Supabase dashboard, click "Resume"). This is fatal to the "frictionless" goal — it's worse than a paper list.

**Prevention:**
- Set up a scheduled GitHub Actions workflow to ping the Supabase health endpoint (`/auth/v1/health` or a lightweight REST query) once every few days.
- Alternatively, use a cron job on any free scheduler (GitHub Actions free tier is sufficient).
- This is a known problem with documented solutions: the `supabase-pause-prevention` GitHub repo provides a ready-made workflow.

**Warning signs:** No keep-alive mechanism in place. App only tested during active development (when the project is always active).

**Phase:** Infrastructure/deployment phase. Must be set up before going "live" as a real app. Takes 15 minutes and prevents a critical failure mode.

---

### Pitfall 4: RLS Disabled on Supabase Tables (Any Data Is Public)

**What goes wrong:** Supabase's anon key is intentionally embedded in frontend code and is visible in browser network requests. The anon key alone grants full CRUD access to any table where Row Level Security (RLS) is not enabled. Without RLS, *anyone* who finds the anon key (it's in the JS bundle) can read, modify, or delete the entire grocery list database.

**Why it happens:** Supabase's default for newly created tables is: RLS disabled, with `SELECT/INSERT/UPDATE/DELETE` granted to the `anon` role. This is a developer convenience default, not a production-safe default. Many developers ship without changing it.

**Consequences:** For a private two-person app this is a lower-stakes risk than a multi-tenant app, but it still means any curious person who inspects network requests can wipe all data. It is also the most common Supabase security incident pattern (e.g., Moltbook's 1.5M key exposure in Jan 2026 was RLS-off on a public table).

**Prevention:**
- Enable RLS on every table from day one, before writing any data.
- Since there is no authentication (shared link access only), the RLS policy must use the shared list ID (a UUID in the URL) as the access token. A policy like `list_id = current_setting('app.list_id')` enforces row-level scoping per list.
- Alternatively: keep the database fully server-side (Next.js API routes / server actions only) and never expose the Supabase service key to the client. The frontend talks only to your own API, which performs access checks before touching Supabase.
- Audit: confirm RLS status in Supabase dashboard > Table Editor > each table's "RLS" badge.

**Warning signs:** Supabase client initialized in frontend code with `createClient(url, anonKey)` and tables have no RLS policies. Network tab shows direct calls to `supabase.co/rest/v1/`.

**Phase:** Data modeling phase (first phase that touches Supabase). RLS policies must be defined before any data is written, not bolted on afterward.

---

## Moderate Pitfalls

Mistakes that create pain and user confusion, but don't require a full rewrite.

---

### Pitfall 5: No Visual Sync Status = Users Don't Know What's Real

**What goes wrong:** The app shows no indication of its connection state. When the WebSocket drops (see Pitfall 1), both users just see whatever the last state was, with no way to know if it's current. The at-store user taps "Add milk" and nothing happens. They tap again. They don't know if it worked.

**Why it happens:** Developers test on local networks and fast connections where latency is invisible. The phone-in-a-grocery-store scenario has patchy WiFi, 4G handoffs, and a locked screen between aisles.

**Prevention:**
- Always show a sync status indicator: a subtle colored dot or banner ("Live", "Reconnecting...").
- Implement optimistic UI for add/check-off actions: apply the change instantly in local state, then confirm (or roll back) when the database responds.
- On reconnect, show "Synced" briefly so the user knows the connection is restored.

**Warning signs:** No connection status UI. No loading/pending state on mutations.

**Phase:** Core UI phase. Design the sync indicator as a first-class UI component, not a late addition.

---

### Pitfall 6: Touch Targets Too Small for In-Store Use (Gloved Hands, One Thumb)

**What goes wrong:** The check-off interaction — the single most frequent action in the app — has a small checkbox or tap target. In a grocery store, the user is holding the phone in one hand, possibly wearing gloves, with the list jostling as they push a cart. Small targets cause mis-taps: accidentally checking items that haven't been bought, or failing to check items that have.

**Why it happens:** Developers test by clicking with a mouse cursor or tapping carefully on a resting phone. Real grocery use is one-handed and distracted.

**Consequences:** The app becomes more frustrating than a paper list. The core use case fails.

**Prevention:**
- Minimum touch target: 44x44px (Apple HIG) / 48x48dp (Material), with adequate spacing between targets.
- The entire list item row should be the tap target for check-off, not just a checkbox widget.
- Test on a physical device, one-handed, while walking.
- Place the primary action (check-off) on the dominant-hand side (right edge for most users) or make it the full row.

**Warning signs:** Checkbox is implemented as a small `<input type="checkbox">` with default browser sizing. Delete button is adjacent to the check-off target with no spacing buffer.

**Phase:** UI/component phase. Define touch target rules before building list item components.

---

### Pitfall 7: "Clear Checked Items" Deletes Without Confirmation, Surprising the Partner

**What goes wrong:** One user taps "Clear completed" to clean up the list after shopping. The other user, who may still be at the store and hasn't seen the items get cleared, suddenly sees the list wipe. There's no undo. If the list had items they hadn't noticed were checked (checked by mistake), they're now gone.

**Why it happens:** Clear-all is implemented as a single-tap destructive action with no confirmation. In a single-user app, this is acceptable. In a two-user real-time app, destructive shared actions need more friction.

**Prevention:**
- Require a confirmation step for "Clear completed" (e.g., a bottom sheet "Remove 5 checked items?").
- Show a brief "undo" window (5-10 seconds) after clearing, implemented as a soft-delete (mark `deleted_at`, filter from queries, purge after timeout).
- The check-off-then-clear flow identified in PROJECT.md is correct; the risk is in the "clear" step being too easy to trigger accidentally.

**Warning signs:** "Clear" is a single-tap button with no confirmation. Deletion is hard-delete (immediate `DELETE FROM items`).

**Phase:** Core features phase, when implementing the check-off/clear flow.

---

### Pitfall 8: URL-Based Access Means Anyone With the Link Has Full Write Access

**What goes wrong:** The shared link (`/list/abc123`) is the only access control. If the link leaks — sent over SMS, stored in browser history, or scanned in a screenshot — anyone who has it can add, check off, or clear items. More practically: the link could end up in a messaging app's link preview cache or a browser sync.

**Why it happens:** No-auth shared link is deliberately chosen for frictionlessness. The risk is the trade-off.

**Prevention:**
- Use a UUID v4 (or CUID2) for the list ID — 122 bits of randomness makes brute-force impossible.
- Do not use sequential IDs or short codes for the list identifier.
- Accept that for a private two-person app, this level of obscurity is sufficient (this is the same model OurList uses by design).
- Document this explicitly so the decision is not re-litigated: "We are not defending missile silos."
- Optionally: add a simple PIN or 4-digit code as a secondary check if the couple wants it later, but do not block launch on this.

**Warning signs:** List IDs are sequential integers (`/list/42`), short strings, or predictable patterns.

**Phase:** Data modeling phase. The list ID format must be decided before any data is written or links are generated.

---

## Minor Pitfalls

Low-severity issues that create friction but don't break the app.

---

### Pitfall 9: Implementing the Wrong Supabase Realtime Mode

**What goes wrong:** Using Supabase Postgres Changes (database-level WAL streaming) for every interaction, including high-frequency ones. For a two-person grocery app this is fine at low volume, but using `Broadcast` mode for ephemeral signals (e.g., "user is typing" or presence indicators) unnecessarily writes to the database and consumes WAL throughput.

**Prevention:**
- Use `Postgres Changes` for item adds, check-offs, and deletes — these need persistence.
- Use `Broadcast` for any ephemeral signals that don't need to be stored.
- For this app's scale (2 users, occasional updates), either mode works; just don't write ephemeral state to the database.

**Phase:** Core real-time sync phase.

---

### Pitfall 10: Over-Engineering the Data Model Before Validating Core Value

**What goes wrong:** Developer adds categories, quantities, sort orders, per-item metadata, and multi-list support before the basic add/check-off/sync loop is proven to work reliably. The schema becomes complex, migrations pile up, and the UI is cluttered before anyone has confirmed the core value is real.

**Why it happens:** Developers know what features could exist and build toward the imagined product instead of the validated one. PROJECT.md already has several items explicitly out of scope — this pitfall is about violating that discipline.

**Prevention:**
- Ship Phase 1 as: item name only, check-off, clear, real-time sync. Nothing else.
- Add quantity and category only after the core loop is confirmed working reliably on real phones in a real store.
- Keep the database schema minimal: `id`, `list_id`, `name`, `checked`, `created_at`. Add columns in later phases.

**Warning signs:** Schema includes `quantity`, `category`, `sort_order`, `aisle`, `unit` before Phase 1 is deployed and tested.

**Phase:** All phases. Enforce scope discipline at each phase boundary.

---

### Pitfall 11: Empty State After "Clear" Feels Broken

**What goes wrong:** After clearing checked items (or before any items are added), the list shows a blank screen. New users — or users returning after a clear — don't understand whether the app is loaded, whether sync is working, or whether something went wrong.

**Prevention:**
- Design an explicit empty state: "Your list is empty. Add the first item below."
- The empty state should be visually distinct from a loading state and a disconnected state.
- A just-cleared list should briefly show a "List cleared" confirmation before rendering the empty state.

**Phase:** UI/component phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Database setup | RLS disabled by default on new tables | Enable RLS and write policies before any other work |
| Data modeling | Sequential or short list IDs | Use UUID v4 / CUID2 from the start |
| Real-time sync setup | Fetch-then-subscribe gap | Subscribe before fetching; merge queued events |
| Real-time sync setup | Silent disconnection | Implement connection status tracking on day one |
| Core UI components | Small touch targets for check-off | Full-row tap target, minimum 44px height |
| Core features (check-off/clear) | Destructive clear without confirmation | Confirmation step + soft-delete with undo window |
| Deployment | Supabase project pauses after 7 days | Set up keep-alive cron job before launch |
| All phases | Over-engineering beyond validated scope | Enforce PROJECT.md out-of-scope list at every phase |

---

## Sources

- [Supabase Realtime in Practice: WebSocket Connection Management](https://eastondev.com/blog/en/posts/dev/supabase-realtime-practice/) — silent disconnection patterns, background tab throttling
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — free tier concurrent connections and message rates
- [Supabase Free Tier Limits 2026](https://aiagencyplus.com/supabase-free-tier-limits/) — project pause policy, storage and connection caps
- [Prevent Supabase Free Tier Pausing](https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263) — keep-alive cron job solutions
- [supabase-pause-prevention GitHub repo](https://github.com/travisvn/supabase-pause-prevention) — ready-made GitHub Actions workflow
- [Supabase Security: Exposed Anon Keys, RLS, and Misconfigurations](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster) — RLS pitfalls and real-world incidents
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy design
- [Handling Race Conditions in Real-Time Apps](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8) — fetch/subscribe gap and event queueing patterns
- [Sensitive data in URLs: Why private links aren't private](https://pulsesecurity.co.nz/articles/unguessable_url_issues) — shared link access risks
- [Touch Targets on Touchscreens — Nielsen Norman Group](https://www.nngroup.com/articles/touch-target-size/) — minimum touch target sizing
- [Safari dropping WebSocket connection due to inactivity](https://github.com/socketio/socket.io/issues/2924) — iOS Safari-specific WebSocket disconnection behavior
- [Optimistic UI updates and conflict resolution](https://borstch.com/snippet/optimistic-ui-updates-and-conflict-resolution) — server-truth reconciliation pattern
