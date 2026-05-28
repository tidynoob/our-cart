# Roadmap: Our Cart

## Milestones

- **v1.0 MVP** — Phases 1-5 (shipped 2026-05-26) | [Archive](milestones/v1.0-ROADMAP.md)
- **v2.0 Accounts & Multi-List** — Phases 6-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) — SHIPPED 2026-05-26</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-05-25
- [x] Phase 2: List Management (5/5 plans) — completed 2026-05-25
- [x] Phase 3: Shopping Flow (2/2 plans) — completed 2026-05-25
- [x] Phase 4: Real-Time Sync (4/4 plans) — completed 2026-05-26
- [x] Phase 5: Mobile UX (5/5 plans) — completed 2026-05-26

</details>

### v2.0 Accounts & Multi-List

- [ ] **Phase 6: Auth Foundation** - Google OAuth sign-in, persistent session, route protection, and database auth scaffolding
- [ ] **Phase 7: Lists Infrastructure** - Multi-list database layer, CRUD operations, and route structure
- [ ] **Phase 8: App Shell & Sidebar** - Slide-in sidebar drawer with list navigation and visual active state
- [ ] **Phase 9: Auth Integration into ListPage** - User profile display, display name editing, sign out, and header re-expand
- [ ] **Phase 10: List Sharing** - Shareable invite links with redemption flow

## Phase Details

### Phase 6: Auth Foundation

**Goal**: Users can sign in with Google and the app knows who they are across sessions
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):

  1. User can tap "Sign in with Google" and complete OAuth flow to reach the app
  2. After closing and reopening the browser, user is still signed in without re-authenticating
  3. Visiting any list URL without being signed in redirects to the login page
  4. After completing OAuth redirect, user lands on the correct destination (not a blank callback page)

**Plans**: 5 plans

Plans:

- [x] 06-01-PLAN.md — OAuth provider config (human) + Wave 0 test scaffolds
- [x] 06-02-PLAN.md — authStore TDD implementation (AUTH-01, AUTH-02)
- [x] 06-03-PLAN.md — ProtectedRoute TDD + App/router/supabase wiring (AUTH-03)
- [ ] 06-04-PLAN.md — LandingPage transformation + LoginPage component (AUTH-01)
- [x] 06-05-PLAN.md — Database migrations: items.user_id + lists.owner_id + RLS policies

**UI hint**: yes

### Phase 7: Lists Infrastructure

**Goal**: Users own named lists and can create, rename, and delete them
**Depends on**: Phase 6
**Requirements**: LIST-01, LIST-02, LIST-03
**Success Criteria** (what must be TRUE):

  1. User can create a new list by entering a name, and it appears as a navigable destination
  2. User can rename an existing list and see the new name reflected everywhere it appears
  3. User can delete a list — but only after confirming in a dialog; cancelling leaves the list intact
  4. Deleted lists no longer appear in navigation or at their URL

**Plans**: TBD

### Phase 8: App Shell & Sidebar

**Goal**: Users can see all their lists and switch between them from a persistent sidebar
**Depends on**: Phase 7
**Requirements**: NAV-01, NAV-02
**Success Criteria** (what must be TRUE):

  1. User can open a sidebar drawer (from any list page) that lists all their lists
  2. The currently viewed list is visually distinct from other lists in the sidebar
  3. Tapping a list in the sidebar navigates to that list and closes the sidebar
  4. Sidebar is accessible on both mobile and desktop without layout breakage

**Plans**: TBD
**UI hint**: yes

### Phase 9: Auth Integration into ListPage

**Goal**: The list experience reflects who the user is — their name, avatar, and ability to sign out
**Depends on**: Phase 8
**Requirements**: PROF-01, PROF-02, PROF-03, NAV-03
**Success Criteria** (what must be TRUE):

  1. User's Google avatar is visible in the sidebar and on items they have added
  2. User can edit their display name and see it update on their existing item attributions
  3. User can sign out from within the app and is returned to the login page
  4. A dismissed share-code header can be re-expanded without refreshing the page

**Plans**: TBD
**UI hint**: yes

### Phase 10: List Sharing

**Goal**: Users can invite a partner to a specific list via a shareable link
**Depends on**: Phase 9
**Requirements**: SHARE-01, SHARE-02
**Success Criteria** (what must be TRUE):

  1. User can tap a share button in the list header to copy or share an invite link
  2. A partner who opens the invite link and signs in is added to the list and can see its items
  3. The invite link is stable — sharing it multiple times leads to the same list, not duplicate memberships

**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-05-25 |
| 2. List Management | v1.0 | 5/5 | Complete | 2026-05-25 |
| 3. Shopping Flow | v1.0 | 2/2 | Complete | 2026-05-25 |
| 4. Real-Time Sync | v1.0 | 4/4 | Complete | 2026-05-26 |
| 5. Mobile UX | v1.0 | 5/5 | Complete | 2026-05-26 |
| 6. Auth Foundation | v2.0 | 4/5 | In Progress|  |
| 7. Lists Infrastructure | v2.0 | 0/? | Not started | - |
| 8. App Shell & Sidebar | v2.0 | 0/? | Not started | - |
| 9. Auth Integration into ListPage | v2.0 | 0/? | Not started | - |
| 10. List Sharing | v2.0 | 0/? | Not started | - |

---
*Roadmap created: 2026-05-24*
*v1.0 MVP shipped: 2026-05-26*
*v2.0 roadmap added: 2026-05-27*
*Phase 6 planned: 2026-05-27*
