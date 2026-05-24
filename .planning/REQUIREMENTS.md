# Requirements: Our Cart

**Defined:** 2026-05-24
**Core Value:** Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### List Management

- [ ] **LIST-01**: User can add item with name (required), quantity (optional), and category (optional)
- [ ] **LIST-02**: User can edit an existing item's name, quantity, or category
- [ ] **LIST-03**: User can delete an item from the list
- [ ] **LIST-04**: Items display who added them (initials or color indicator per device/person)
- [ ] **LIST-05**: Previously added items appear as autocomplete suggestions during entry
- [ ] **LIST-06**: Items auto-sort by category in the list view (Produce, Dairy, etc.)

### Real-Time Sync

- [ ] **SYNC-01**: Changes (add, edit, check off, delete, clear) appear on both devices within 2 seconds
- [ ] **SYNC-02**: App reconnects and re-fetches after WebSocket disconnection (e.g., screen lock on mobile)
- [ ] **SYNC-03**: Connection status indicator shows whether sync is active

### Sharing

- [ ] **SHARE-01**: User can create a new list and receive a shareable link or code
- [ ] **SHARE-02**: Partner can join the list by opening the shared link — no account creation needed
- [ ] **SHARE-03**: Shared link acts as the only access credential (URL contains list ID)

### Shopping Flow

- [ ] **SHOP-01**: User can check off an item (item stays visible, shown crossed out/dimmed)
- [ ] **SHOP-02**: User can uncheck a previously checked item
- [ ] **SHOP-03**: User can clear all checked items (removes from both views)
- [ ] **SHOP-04**: Clear action requires confirmation before executing

### Mobile UX

- [ ] **UX-01**: Layout is phone-first and responsive (works on desktop too)
- [ ] **UX-02**: Tap targets are large enough for one-handed use while walking (min 44px)
- [ ] **UX-03**: Adding an item takes fewer than 3 taps from app open

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Items

- **ITEM-01**: User can add a notes field to an item ("Get the Trader Joe's brand")
- **ITEM-02**: User can reorder items manually within a category

### Operational

- **OPS-01**: Supabase keep-alive prevents project pausing after 7 days inactivity
- **OPS-02**: Presence indicator shows partner is currently viewing the list

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multiple lists | Fragments attention; one shared list is the core value for v1 |
| User accounts / authentication | Friction — shared link is sufficient for two-person private use |
| Offline / PWA mode | Requires complex sync conflict resolution; internet required |
| Recipe integration / meal planning | This is a list, not a meal planner |
| Pantry inventory tracking | Rarely maintained in practice; doesn't serve core problem |
| Price tracking / budgeting | High data maintenance; bank apps solve this |
| Barcode scanning | Camera permission + lookup API complexity; name + qty sufficient |
| Push notifications | Real-time sync on screen is sufficient; see changes on app open |
| Aisle-layout store mapping | Store layouts vary and change; simple categories are enough |
| Voice assistant integration | High complexity, niche usage for private web app |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIST-01 | TBD | Pending |
| LIST-02 | TBD | Pending |
| LIST-03 | TBD | Pending |
| LIST-04 | TBD | Pending |
| LIST-05 | TBD | Pending |
| LIST-06 | TBD | Pending |
| SYNC-01 | TBD | Pending |
| SYNC-02 | TBD | Pending |
| SYNC-03 | TBD | Pending |
| SHARE-01 | TBD | Pending |
| SHARE-02 | TBD | Pending |
| SHARE-03 | TBD | Pending |
| SHOP-01 | TBD | Pending |
| SHOP-02 | TBD | Pending |
| SHOP-03 | TBD | Pending |
| SHOP-04 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-05-24*
*Last updated: 2026-05-24 after initial definition*
