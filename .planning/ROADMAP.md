# Roadmap: Our Cart

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-26) | [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Accounts & Multi-List** — Phases 6-10 (shipped 2026-05-31) | [Archive](milestones/v2.0-ROADMAP.md)
- 🔄 **v2.1 Polish, Profiles & Member Management** — Phases 11-15 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-05-26</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-05-25
- [x] Phase 2: List Management (5/5 plans) — completed 2026-05-25
- [x] Phase 3: Shopping Flow (2/2 plans) — completed 2026-05-26
- [x] Phase 4: Real-Time Sync (4/4 plans) — completed 2026-05-26
- [x] Phase 5: Mobile UX (5/5 plans) — completed 2026-05-26

</details>

<details>
<summary>✅ v2.0 Accounts & Multi-List (Phases 6-10) — SHIPPED 2026-05-31</summary>

- [x] Phase 6: Auth Foundation (5/5 plans) — completed 2026-05-28
- [x] Phase 7: Lists Infrastructure (4/4 plans) — completed 2026-05-29
- [x] Phase 8: App Shell & Sidebar (3/3 plans) — completed 2026-05-29
- [x] Phase 9: Auth Integration into ListPage (5/5 plans) — completed 2026-05-29
- [x] Phase 10: List Sharing (6/6 plans) — completed 2026-05-31

Full phase detail: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

**v2.1 Polish, Profiles & Member Management (Phases 11-15)**

- [ ] **Phase 11: Profiles Foundation & Hardening** — Public profiles table, cross-user avatars/names, member management, RLS hardening
- [x] **Phase 12: Presence** — Live indicator showing who else is viewing the same list (completed 2026-06-01)
- [x] **Phase 13: Enhanced Items** — Notes, drag-to-reorder (cross-category), quantity steppers, duplicate warning, swipe-to-delete (completed 2026-06-05)
- [ ] **Phase 14: Shopping Flow & QoL** — Undo clear, uncheck-all, item count badge, auto-categorize, checked-to-bottom toggle, haptic feedback
- [ ] **Phase 15: Keep-Alive & PWA** — Supabase free-tier keep-alive, installable PWA (manifest-only, no offline caching)

## Phase Details

### Phase 11: Profiles Foundation & Hardening

**Goal**: Members see each other's real Google avatars and live display names on shared lists, owners can remove members and members can leave lists, and INSERT RLS is tightened to reject legacy null-owner rows
**Depends on**: Phase 10 (List Sharing — provides list_members table and membership model)
**Requirements**: PROF-04, PROF-05, MEMBER-01, MEMBER-02, HARD-01, HARD-02
**Success Criteria** (what must be TRUE):

  1. On a shared list, user A sees user B's Google avatar next to items B added (not initials or a placeholder)
  2. If user B updates their display name in their profile, user A sees the new name on B's items without a page reload
  3. The list owner can remove another member; the removed member's UI ejects them from the list in real-time (not waiting for JWT expiry)
  4. A non-owner member can leave a shared list they joined; leaving removes them from the list and returns them to their list index
  5. Attempting to INSERT a list or item with a null owner_id is rejected by RLS; no legacy null-owner branches remain in policy SQL

**Plans**: 9 plansPlans:
**Wave 1**

- [x] 11-01-PLAN.md — Wave 0 test stubs (profilesStore, MembersDialog, displayName, Spinner)
- [x] 11-02-PLAN.md — SQL migrations: profiles table + trigger + backfill, member management RPCs
- [x] 11-03-PLAN.md — HARD-02 utilities: displayName.ts + Spinner.tsx

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-04-PLAN.md — INSERT hardening SQL (insert_hardening.sql, pre-flight + lists_insert replacement)
- [x] 11-05-PLAN.md — profilesStore.ts (Zustand store, loadForList, patch, unsubscribe)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-07-PLAN.md — MembersDialog.tsx + ListPage header trigger button

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 11-06-PLAN.md — Client wiring: authStore upsert, ListPage channels + ejection, ItemRow attribution

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 11-08-PLAN.md — [BLOCKING] Schema push to live Supabase project

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 11-09-PLAN.md — Human UAT checkpoint (two-browser verification)

**UI hint**: yes

### Phase 12: Presence

**Goal**: Users can see at a glance whether their partner is currently viewing the same list
**Depends on**: Phase 11 (Profiles Foundation — presence attribution reads from public.profiles)
**Requirements**: OPS-02
**Success Criteria** (what must be TRUE):

  1. When both users are on the same list page, each user sees an avatar or indicator for the other user
  2. The presence indicator disappears within a few seconds when the partner navigates away or closes the tab
  3. Viewing the same list in two tabs shows only one presence entry per user (deduplication)

**Plans**: 2 plans
**UI hint**: yes

Plans:

**Wave 0**

- [x] 12-01-PLAN.md — Wave 0 failing test stubs (presenceStore + PresenceIndicator) pinning OPS-02 contract

**Wave 1** *(blocked on Wave 0)*

- [x] 12-02-PLAN.md — presenceStore + PresenceIndicator implementation, ListPage mount/header wiring, authStore TOKEN_REFRESHED retrack seam

### Phase 13: Enhanced Items

**Goal**: Users can add notes to items, manually reorder items (including across categories), adjust quantity with steppers, be warned of duplicates, and swipe to delete
**Depends on**: Phase 11 (schema migrations — note and position columns added to items)
**Requirements**: ITEM-01, ITEM-02, ITEM-03, ITEM-04, ITEM-05
**Success Criteria** (what must be TRUE):

  1. User can add or edit a free-text note on any item; the note is visible to both members and syncs in real-time
  2. User can drag an item to a new position within a category; dragging it into a different category's section reassigns that item's category; the new order syncs to the other member
  3. User can tap +/- buttons to increment or decrement an item's quantity; the stepper cannot go below 1
  4. When adding an item whose name (case-insensitive) already exists unchecked on the list, a non-blocking warning appears before submission
  5. User can swipe an item row horizontally to trigger deletion without tapping a separate delete button

**Plans**: 8 plans (5 + 3 gap closure)
**UI hint**: yes

Plans:

**Wave 0**

- [x] 13-00-PLAN.md — Wave 0 failing test stubs (ordering/categories/itemsStore/ItemRow/AddItemBar) pinning ITEM-01..05 contracts

**Wave 1** *(blocked on Wave 0)*

- [x] 13-01-PLAN.md — Foundation: deps install + enhanced_items.sql migration + [BLOCKING] schema push + Item type + ordering.ts + categories.ts position sort

**Wave 2** *(blocked on Wave 1)*

- [x] 13-02-PLAN.md — itemsStore: reorderItem + pendingReorders echo guard + widened updateItem Pick + addItem position-on-insert

**Wave 3** *(blocked on Wave 2)*

- [x] 13-03-PLAN.md — ItemRow: note display/edit, quantity stepper, drag handle (useSortable), swipe-to-delete

**Wave 4** *(blocked on Wave 2 + Wave 3)*

- [x] 13-04-PLAN.md — Wiring: ListPage DndContext/sensors/handlers + CategorySection SortableContext/Pick widen + AddItemBar duplicate warning

**Gap closure** *(UAT tests 2 & 3 — ItemRow desktop-mouse interaction regression)*

- [x] 13-05-PLAN.md — Gate swipe on active press + stop foreground overlay stealing checkbox/Delete clicks; regression tests for hover-drag, snap-back, overlay click-steal

**Gap closure v2** *(UAT tests 2/4/7 — ItemRow capture-on-tap recurrence; test 6 — AddItemBar dup-warning flash)*

- [x] 13-06-PLAN.md — ItemRow: capture only on an actual swipe (not on tap) + guard row-tap by pointerdown origin + delta>0 swipe-back un-reveal (UAT gaps 2/4/7)
- [x] 13-07-PLAN.md — AddItemBar: clear input synchronously before optimistic insert to stop the brand-new-item dup-warning flash (UAT gap 6)

### Phase 14: Shopping Flow & QoL

**Goal**: The shopping experience is smoother — users can undo an accidental clear, re-shop a completed list, see item counts at a glance, get category suggestions automatically, choose where checked items live, and feel haptic confirmation on check-off
**Depends on**: Phase 13 (item store has uncheckAll/lastCleared buffer; item_history supports auto-categorize)
**Requirements**: SHOP-05, SHOP-06, VIEW-01, QOL-01, QOL-02, QOL-03
**Success Criteria** (what must be TRUE):

  1. After clearing checked items, a dismissible undo prompt appears; tapping it restores all just-cleared items within the 5-second window
  2. User can uncheck all items at once to start re-shopping the same list (with a confirmation step)
  3. The list header shows a live count of total items and how many are checked (e.g., "3 / 12 checked"), updating as items are added or checked
  4. When typing an item name in the add form, a category is pre-filled based on past history for that name (user can override before submitting)
  5. Toggling "checked items to bottom" moves all checked items below unchecked items; the preference persists across sessions; toggling off restores in-category order
  6. Checking off an item on a mobile device with vibration support triggers a short haptic pulse

**Plans**: 5 plans

Plans:

**Wave 0**

- [x] 14-01-PLAN.md — Wave 0 RED-test gate: 3 new test files (preferencesStore, haptics, UndoSnackbar) + 4 extensions + Supabase array-insert mock + A1 probe (pins SC-1..SC-6)

**Wave 1** *(blocked on Wave 0)*

- [x] 14-02-PLAN.md — Leaf utilities: haptics.ts (QOL-03) + categories.ts checkedToBottom sort key (QOL-02) + persisted preferencesStore.ts (QOL-02)
- [ ] 14-03-PLAN.md — AddItemBar auto-categorize prefill from per-list history + categoryTouched guard (QOL-01)

**Wave 2** *(blocked on Wave 1)*

- [ ] 14-04-PLAN.md — itemsStore: lastCleared/undoClear/clearLastCleared (SHOP-05) + uncheckAll (SHOP-06) + haptic-on-check-ON (QOL-03)

**Wave 3** *(blocked on Wave 2)*

- [ ] 14-05-PLAN.md — UndoSnackbar component + ListPage wiring: count badge (VIEW-01), uncheck-all button+dialog (SHOP-06), checked-to-bottom toggle (QOL-02), undo snackbar mount (SHOP-05)

**UI hint**: yes

### Phase 15: Keep-Alive & PWA

**Goal**: The Supabase project never pauses due to inactivity, and users can install the app to their home screen on both Android and iOS
**Depends on**: Phase 14 (profiles endpoint established in Phase 11 for the keep-alive ping target)
**Requirements**: OPS-01, PWA-01
**Success Criteria** (what must be TRUE):

  1. A GitHub Actions workflow runs daily and touches the Supabase database (ping to /rest/v1/profiles?limit=1), preventing the 7-day inactivity pause on the free tier
  2. On Android Chrome, the browser shows an "Add to Home Screen" install prompt for the app
  3. On iOS Safari, the app displays a manual "Add to Home Screen" instruction banner guiding the user through Share > Add to Home Screen
  4. After installing, launching the app from the home screen opens it in a standalone window (no browser chrome)
  5. The installed PWA does not cache assets offline; a network connection is required (no service-worker fetch handler)

**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-05-25 |
| 2. List Management | v1.0 | 5/5 | Complete | 2026-05-25 |
| 3. Shopping Flow | v1.0 | 2/2 | Complete | 2026-05-26 |
| 4. Real-Time Sync | v1.0 | 4/4 | Complete | 2026-05-26 |
| 5. Mobile UX | v1.0 | 5/5 | Complete | 2026-05-26 |
| 6. Auth Foundation | v2.0 | 5/5 | Complete | 2026-05-28 |
| 7. Lists Infrastructure | v2.0 | 4/4 | Complete | 2026-05-29 |
| 8. App Shell & Sidebar | v2.0 | 3/3 | Complete | 2026-05-29 |
| 9. Auth Integration into ListPage | v2.0 | 5/5 | Complete | 2026-05-29 |
| 10. List Sharing | v2.0 | 6/6 | Complete | 2026-05-31 |
| 11. Profiles Foundation & Hardening | v2.1 | 9/10 | In Progress|  |
| 12. Presence | v2.1 | 2/2 | Complete   | 2026-06-01 |
| 13. Enhanced Items | v2.1 | 8/8 | Complete   | 2026-06-06 |
| 14. Shopping Flow & QoL | v2.1 | 2/5 | In Progress|  |
| 15. Keep-Alive & PWA | v2.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-05-24*
*v1.0 MVP shipped: 2026-05-26*
*v2.0 Accounts & Multi-List shipped: 2026-05-31*
*v2.1 roadmap created: 2026-05-31*
