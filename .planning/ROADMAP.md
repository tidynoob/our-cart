# Roadmap: Our Cart

## Overview

Our Cart ships in five phases that mirror the dependency graph of the app itself: stand up the data layer and shareable link first, then build list CRUD, then the shopping check-off flow, then layer real-time sync on top of proven mutations, and finally harden the mobile experience. Every phase delivers a coherent, independently testable capability. Nothing is deferred except what research explicitly calls v2.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Supabase schema, RLS, and shareable list link
- [ ] **Phase 2: List Management** - Add, edit, delete, and display items
- [ ] **Phase 3: Shopping Flow** - Check off, uncheck, and clear completed items
- [ ] **Phase 4: Real-Time Sync** - Live updates across both devices
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
**Plans**: TBD

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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD

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
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. List Management | 0/TBD | Not started | - |
| 3. Shopping Flow | 0/TBD | Not started | - |
| 4. Real-Time Sync | 0/TBD | Not started | - |
| 5. Mobile UX | 0/TBD | Not started | - |

---
*Roadmap created: 2026-05-24*
*Coverage: 19/19 v1 requirements mapped*
