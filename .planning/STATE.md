---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Accounts & Multi-List
status: executing
last_updated: "2026-05-29T03:19:23.429Z"
last_activity: 2026-05-29
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-27)

**Core value:** Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.
**Current focus:** Phase 07 — lists-infrastructure

## Current Position

Phase: 07 (lists-infrastructure) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-05-29

```
v2.0 Progress: [----------] 0% (0/5 phases)

Phase 6: Auth Foundation       [ ] Not started
Phase 7: Lists Infrastructure  [ ] Not started
Phase 8: App Shell & Sidebar   [ ] Not started
Phase 9: Auth Integration      [ ] Not started
Phase 10: List Sharing         [ ] Not started
```

## Performance Metrics

| Metric | v1.0 | v2.0 Target |
|--------|------|-------------|
| Phases | 5 | 5 |
| Plans per phase | 3.8 avg | TBD |
| LOC | 3,888 | TBD |
| Phase 07 P01 | 59 | 2 tasks | 2 files |
| Phase 07 P02 | 120 | 2 tasks | 5 files |

## Accumulated Context

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Auth before Lists | RLS policies require auth.uid(); lists schema depends on owner_id |
| Lists before Sidebar | Sidebar needs list data to render; must exist first |
| Sidebar before Profile | AppShell layout hosts profile section; logical containment |
| Profile/Auth wiring before Sharing | Sharing requires knowing who owns what list |
| PKCE for OAuth | Preferred by OAuth 2.1; Supabase default |
| Nullable user_id on items | v1.0 items have no user_id; policy: `user_id IS NULL OR user_id = auth.uid()` |
| Persistent invite tokens | No expiry for 2-person household use |
| SECURITY DEFINER invite lookup | Avoids RLS catch-22 for unauthenticated invite token resolution |

### Watch Out For

- Enable RLS + create policies in the SAME migration — never enable RLS without policies
- OAuth redirect URL must match in 3 places: Supabase Site URL, Supabase allowlist, Google Cloud Console
- `onAuthStateChange` callback must NOT be async (Supabase requirement)
- Call `realtime.setAuth()` on auth state change — JWT is cached at channel-open
- Use `(select auth.uid())` not bare `auth.uid()` in RLS policies (query planner caching)
- INSERT/UPDATE RLS policies need both `USING` and `WITH CHECK`
- `isLoading` guard required on ProtectedRoute to prevent auth state flash

### Todos

- Pre-code checklist: OAuth redirect URL matrix (3 environments) before Phase 6

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Operational | Supabase keep-alive (OPS-01) | v2.x | Roadmap creation |
| Operational | Presence indicator (OPS-02) | v2.x | Roadmap creation |
| Enhanced Items | Item notes field (ITEM-01) | v2.x | Roadmap creation |
| Enhanced Items | Manual item reorder (ITEM-02) | v2.x | Roadmap creation |
| Member Management | Owner can remove member (MEMBER-01) | v2.x | Roadmap creation |
| Member Management | Member can leave list (MEMBER-02) | v2.x | Roadmap creation |

## Session Continuity

Last session: 2026-05-29T03:19:23.423Z
Stopped at: Completed 07-02-PLAN.md — lists-home UI + CreateListForm migration
Resume file: None
Next action: `/gsd-plan-phase 6`

## Decisions

- [Phase ?]: useListsStore() called without selector in LandingPage for mock-compatible test behavior
- [Phase ?]: CreateListForm delegates to listsStore.createList — owner_id NULL tech debt D-04 closed
