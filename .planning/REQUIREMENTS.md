# Requirements: Our Cart

**Defined:** 2026-05-27
**Core Value:** Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.

## v2.0 Requirements

Requirements for Accounts & Multi-List milestone. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign in with Google OAuth (one-tap)
- [ ] **AUTH-02**: User session persists across browser refresh and close
- [ ] **AUTH-03**: Unauthenticated users are redirected to login page

### Profile

- [ ] **PROF-01**: User can edit their display name
- [ ] **PROF-02**: User's Google avatar displays in sidebar and item attribution
- [ ] **PROF-03**: User can sign out

### List Management

- [ ] **LIST-01**: User can create a new named list
- [ ] **LIST-02**: User can rename an existing list
- [ ] **LIST-03**: User can delete a list (with confirmation dialog)

### Navigation

- [ ] **NAV-01**: User can open a slide-in sidebar showing all their lists
- [ ] **NAV-02**: Currently viewed list is visually highlighted in sidebar
- [ ] **NAV-03**: User can re-expand the dismissed share code header

### Sharing

- [ ] **SHARE-01**: User can generate a shareable invite link for a list
- [ ] **SHARE-02**: User can access the invite link from a share button in the list header

## Future Requirements

Deferred to v2.x or later.

### Operations
- **OPS-01**: Supabase keep-alive prevents free-tier project pausing
- **OPS-02**: Presence indicator shows who's currently viewing the list

### Enhanced Items
- **ITEM-01**: User can add notes to individual items
- **ITEM-02**: User can manually reorder items within a category

### Member Management
- **MEMBER-01**: Owner can remove a member from a shared list
- **MEMBER-02**: Member can leave a shared list

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Email/password auth | Google OAuth is simpler for household app; one auth method reduces complexity |
| Anonymous/no-auth access | v2.0 requires auth; v1.0 link-share model is replaced |
| Granular permissions/RBAC | Equal collaborators for 2-person household; no owner vs. member distinction in UI |
| Public lists | Private household app; no discovery or public sharing |
| Push notifications | Real-time sync on screen is sufficient |
| Offline writes/PWA | Complex sync conflict resolution; internet required |
| List folders/categories | Overkill for <10 lists |
| Email invitation sending | Text the invite link; no SMTP infrastructure needed |
| More than 2 members per list | Optimized for couples; not a group app |
| Activity feed | 2-person app doesn't need change history |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| PROF-01 | — | Pending |
| PROF-02 | — | Pending |
| PROF-03 | — | Pending |
| LIST-01 | — | Pending |
| LIST-02 | — | Pending |
| LIST-03 | — | Pending |
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| SHARE-01 | — | Pending |
| SHARE-02 | — | Pending |

**Coverage:**
- v2.0 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14

---
*Requirements defined: 2026-05-27*
*Last updated: 2026-05-27 after initial definition*
