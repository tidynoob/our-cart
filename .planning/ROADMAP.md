# Roadmap: Our Cart

## Overview

Our Cart ships in five phases that mirror the dependency graph of the app itself: stand up the data layer and shareable link first, then build list CRUD, then the shopping check-off flow, then layer real-time sync on top of proven mutations, and finally harden the mobile experience. Every phase delivers a coherent, independently testable capability. Nothing is deferred except what research explicitly calls v2.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Supabase schema, RLS, and shareable list link (completed 2026-05-25)
- [x] **Phase 2: List Management** - Add, edit, delete, and display items (completed 2026-05-25)
- [x] **Phase 3: Shopping Flow** - Check off, uncheck, and clear completed items (completed 2026-05-25)
- [x] **Phase 4: Real-Time Sync** - Live updates across both devices (completed 2026-05-26)
- [ ] **Phase 5: Mobile UX** - Phone-first polish, fast entry, and deployment hardening

## Phase Details

### Phase 1: Foundation

**Goal**: A shareable list URL exists and both people can open the same list in a browser
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SHARE-01, SHARE-02, SHARE-03
**Success Criteria** (what must be TRUE):

  1. User can create a new list and receive a shareable URL containing the list ID
  2. Partner can open the shared URL and see the same list — no account or login required
  3. The list URL is the only credential needed to access the list
  4. Supabase tables have RLS enabled — unauthenticated access is scoped to the list ID only

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Vite project, install all dependencies, configure build + test infra, create Supabase project with schema and RLS

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Zustand store, React Router shell, App entry, ListPage with Supabase query, and unit tests for SHARE-01/SHARE-02

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — CreateListForm, JoinListForm, LandingPage, ShareBanner with copy + Web Share API, and ListPage integration (full Walking Skeleton)

### Phase 2: List Management

**Goal**: Users can add, edit, delete, and view grocery items with category grouping
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-06
**Success Criteria** (what must be TRUE):

  1. User can add an item with a name (required), quantity (optional), and category (optional)
  2. User can edit an existing item's name, quantity, or category
  3. User can delete an item from the list
  4. Items display who added them via an initials or color indicator per device
  5. Items are grouped and sorted by category in the list view

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Schema migration (added_by column + UPDATE/DELETE RLS), shadcn Dialog/Select install, Item type, categories/attribution utilities, itemsStore with optimistic CRUD

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — NamePromptDialog, AddItemBar, AttributionBadge, CategorySection, ItemRow, and ListPage integration (add + view vertical slice)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Inline edit mode, delete confirmation, and edit/delete state wiring (edit + delete vertical slice)

**Gap Closure**

- [x] 02-04-PLAN.md — Fix NamePromptDialog Save button (@base-ui/react type override bug) and add regression test
- [x] 02-05-PLAN.md — Fix inline edit category Select portal blur bug (dropdown exits edit mode)

**UI hint**: yes

### Phase 3: Shopping Flow

**Goal**: Users can check off items while shopping and clear completed items when done
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04
**Success Criteria** (what must be TRUE):

  1. User can check off an item — it stays visible in the list, shown crossed out or dimmed
  2. User can uncheck a previously checked item to restore it to active
  3. User can clear all checked items from the list in a single action
  4. Clear action requires an explicit confirmation step before any items are removed

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Base UI Checkbox wrapper, toggleChecked store action, ItemRow display mode with checkbox + checked styling, CategorySection/ListPage wiring (check/uncheck vertical slice — SHOP-01, SHOP-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — clearChecked store action, conditional "Clear completed (N)" button, confirmation Dialog with "Keep Items" / "Clear Items" (clear vertical slice — SHOP-03, SHOP-04)

**UI hint**: yes

### Phase 4: Real-Time Sync

**Goal**: Changes made on one device appear on the other device within 2 seconds, including after reconnection
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):

  1. An item added, edited, checked, unchecked, or deleted on one device appears on the other device within 2 seconds
  2. After a WebSocket disconnection (e.g., phone screen lock), the app reconnects and re-fetches the current list state automatically
  3. A connection status indicator is visible — the user can tell whether sync is active or reconnecting

**Plans**: 3 plans
Plans:
**Wave 0**

- [x] 04-01-PLAN.md — Wave 0 test stubs: extend itemsStore.test.ts with channel mock + .todo stubs for all SYNC behaviors; extend ListPage.test.tsx channel mock; create SyncStatus.test.tsx

**Wave 1** *(blocked on Wave 0 completion)*

- [x] 04-02-PLAN.md — [BLOCKING] Enable supabase_realtime publication for items; add subscribeToList/unsubscribe/syncStatus/channel to itemsStore with idempotent merge reducer; enhance supabase.ts with worker:true (SYNC-01, SYNC-02, SYNC-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — Create SyncStatus component; wire ListPage lifecycle (subscribe-before-fetch, visibilitychange/online reconnect handlers, SyncStatus in header); fill in all test stubs; two-device smoke test (SYNC-02, SYNC-03)

### Phase 5: Mobile UX

**Goal**: The app is fast and frictionless on a phone — adding an item takes under 3 taps and works one-handed in a store
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: UX-01, UX-02, UX-03, LIST-05
**Success Criteria** (what must be TRUE):

  1. The layout is phone-first and fully usable on desktop — no horizontal scroll, no clipped elements
  2. All tap targets are at least 44px — the full item row is tappable for check-off
  3. Adding an item takes fewer than 3 taps from app open on a phone
  4. Previously added items appear as autocomplete suggestions during name entry

**Plans**: 4 plans
Plans:
**Wave 1** *(test stubs)*

- [ ] 05-01-PLAN.md — Wave 0 test stubs: AddItemBar.test.tsx with 6 stubs for LIST-05 autocomplete + UX-02 tap-targets; ItemRow.test.tsx UX-02 stub (UX-02, LIST-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-02-PLAN.md — Deploy polish + tap-target fixes: index.html title/meta/icon, apple-touch-icon.png, SelectTrigger h-11 in AddItemBar + ItemRow, "More details" toggle min-h-[44px]; fill UX-02 stubs (UX-01, UX-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 05-03-PLAN.md — Autocomplete feature: AutocompleteSuggestions.tsx component, AddItemBar wired with local state + Supabase fetch on mount + prefix filter + keyboard nav + selection handler (no auto-submit); fill LIST-05 stubs (LIST-05, UX-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 05-04-PLAN.md — Human verify: final automated checks (build, tsc, vitest), phone walkthrough on real device, Vercel deployment confirmation (UX-01, UX-02, UX-03, LIST-05)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-05-25 |
| 2. List Management | 5/5 | Complete   | 2026-05-25 |
| 3. Shopping Flow | 2/2 | Complete   | 2026-05-25 |
| 4. Real-Time Sync | 4/4 | Complete   | 2026-05-26 |
| 5. Mobile UX | 0/4 | Not started | - |

---
*Roadmap created: 2026-05-24*
*Coverage: 19/19 v1 requirements mapped*
*Phase 1 planned: 2026-05-24 — 3 plans, 3 waves*
*Phase 2 planned: 2026-05-25 — 3 plans, 3 waves*
*Phase 2 gap closure: 2026-05-25 — 2 plans (UAT blocker fixes)*
*Phase 3 planned: 2026-05-25 — 2 plans, 2 waves*
*Phase 4 planned: 2026-05-26 — 3 plans, 3 waves (Wave 0 + Wave 1 + Wave 2)*
*Phase 5 planned: 2026-05-26 — 4 plans, 4 waves (test stubs + deploy polish + autocomplete + human verify)*
