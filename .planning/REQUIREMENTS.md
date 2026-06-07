# Requirements: Our Cart — v2.1 Polish, Profiles & Member Management

**Defined:** 2026-05-31
**Core Value:** Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.

## v2.1 Requirements

Scoped requirements for this milestone. Each maps to a roadmap phase. REQ-IDs continue from v1.0/v2.0.

### Profiles & Attribution

- [x] **PROF-04**: A member sees other members' Google avatar on items they added in a shared list
- [x] **PROF-05**: Member display names render from current profile data (update when a member renames), not frozen at item-add time

### Member Management

- [x] **MEMBER-01**: A list owner can remove another member from a shared list, and the removed member is ejected live
- [x] **MEMBER-02**: A non-owner member can leave a shared list they joined

### Enhanced Items

- [x] **ITEM-01**: User can add and edit a free-text note on an item, synced to other members
- [x] **ITEM-02**: User can drag to reorder items; dragging across category sections re-assigns the item's category; order syncs to other members
- [x] **ITEM-03**: User can change an item's quantity with +/- stepper controls
- [x] **ITEM-04**: User is warned (non-blocking) when adding an item whose name already exists (unchecked, case-insensitive) on the list
- [x] **ITEM-05**: User can swipe an item row to delete it

### Shopping Flow

- [ ] **SHOP-05**: User can undo a clear-checked action and recover the just-cleared items
- [ ] **SHOP-06**: User can uncheck all checked items to re-shop the same list
- [ ] **VIEW-01**: List header shows total item count and checked count, updating live

### Quality-of-Life

- [ ] **QOL-01**: When adding an item, its category is auto-suggested from the item name (overridable)
- [x] **QOL-02**: User can toggle checked items to sink to the bottom of the list (preference persists)
- [x] **QOL-03**: Checking off an item triggers haptic feedback on supporting mobile devices

### Operations

- [ ] **OPS-01**: The Supabase project stays awake on free tier (scheduled keep-alive prevents the 7-day inactivity pause)
- [x] **OPS-02**: User sees a presence indicator showing when their partner is currently viewing the same list

### Shell

- [ ] **PWA-01**: User can install the app to their home screen (manifest + generated icons; iOS shows an Add-to-Home-Screen hint). No offline caching.

### Hardening

- [x] **HARD-01**: List and item INSERT policies require an authenticated owner/member; legacy `owner_id IS NULL` / `user_id IS NULL` WITH CHECK branches are removed
- [x] **HARD-02**: Display-name resolution and loading-spinner markup are deduplicated into shared modules, and loaders carry accessible labels

## Future Requirements

Acknowledged but deferred beyond v2.1.

### Quality-of-Life

- **QOL-04**: Share invite link via prefilled SMS (deferred — not selected for v2.1)
- **QOL-05**: Swipe-to-check gesture (ITEM-05 covers swipe-to-delete; swipe-to-check deferred)
- **QOL-06**: "Frequently bought" quick-add chips
- **QOL-07**: Recently-cleared history view

### Appearance

- **THEME-01**: Dark mode toggle (considered for v2.1, dropped in favor of PWA-01; revisit later)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Offline mode / PWA caching | Requires CRDT/merge conflict resolution; internet assumed available. PWA-01 is install-only (no service-worker caching). |
| More than 2 members per list | Couples-focused, not a group app |
| Granular permissions / RBAC | Members are equal collaborators; only owner-remove + self-leave added |
| Email invitation sending | Text the link; no SMTP |
| Push notifications | On-screen real-time sync + presence (OPS-02) are sufficient |
| Quantity ranges (e.g. "2-3") | ITEM-03 steppers use single integer quantities |
| Budget / running total | Violates "simpler than existing grocery apps" |
| "Needed by" dates | Anti-feature — adds planning complexity a 2-person list doesn't need |
| Store layout / aisle templates | Anti-feature — categories are simple grouping only |
| Multi-list item search | Anti-feature — scope creep for a 2-person app |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-04 | Phase 11 | Complete |
| PROF-05 | Phase 11 | Complete |
| MEMBER-01 | Phase 11 | Complete |
| MEMBER-02 | Phase 11 | Complete |
| HARD-01 | Phase 11 | Complete |
| HARD-02 | Phase 11 | Complete |
| OPS-02 | Phase 12 | Complete |
| ITEM-01 | Phase 13 | Complete |
| ITEM-02 | Phase 13 | Complete |
| ITEM-03 | Phase 13 | Complete |
| ITEM-04 | Phase 13 | Complete |
| ITEM-05 | Phase 13 | Complete |
| SHOP-05 | Phase 14 | Pending |
| SHOP-06 | Phase 14 | Pending |
| VIEW-01 | Phase 14 | Pending |
| QOL-01 | Phase 14 | Pending |
| QOL-02 | Phase 14 | Complete |
| QOL-03 | Phase 14 | Complete |
| OPS-01 | Phase 15 | Pending |
| PWA-01 | Phase 15 | Pending |

**Coverage:**
- v2.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after v2.1 roadmap creation*
