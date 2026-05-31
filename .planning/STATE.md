---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Accounts & Multi-List
status: Awaiting next milestone
last_updated: "2026-05-31T14:59:59.825Z"
last_activity: 2026-05-31 — Milestone v2.0 completed and archived
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 23
  completed_plans: 23
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.
**Current focus:** v2.0 shipped 2026-05-31 — planning next milestone

## Current Position

Phase: Milestone v2.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-05-31 — Milestone v2.0 completed and archived

## Performance Metrics

| Metric | v1.0 | v2.0 Target |
|--------|------|-------------|
| Phases | 5 | 5 |
| Plans per phase | 3.8 avg | TBD |
| LOC | 3,888 | TBD |
| Phase 07 P01 | 59 | 2 tasks | 2 files |
| Phase 07 P02 | 120 | 2 tasks | 5 files |
| Phase 07 P03 | 300 | 1 tasks | 1 files |
| Phase 09 P01 | 10 | 2 tasks | 4 files |
| Phase 09 P03 | 15 minutes | 2 tasks | 3 files |
| Phase 09 P04 | 18 | 3 tasks | 7 files |
| Phase 10-list-sharing P00 | 5 | 2 tasks | 2 files |
| Phase 10-list-sharing P01 | 15 | 3 tasks | 3 files |
| Phase 10 P03 | 99 | 2 tasks | 3 files |
| Phase 10-list-sharing P04 | 2 | 2 tasks | 3 files |

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
| Doc status | Phase 07 UAT (07-HUMAN-UAT.md) — `partial`, 1 scenario blocked_by prior-phase (now unblocked by Phase 10) | doc-debt | v2.0 close |
| Doc status | Phase 08 verification (08-VERIFICATION.md) — `human_needed`, browser-only visual checks, code verified | doc-debt | v2.0 close |
| Doc status | Phase 09 verification (09-VERIFICATION.md) — `human_needed`, code verified | doc-debt | v2.0 close |
| Doc status | Phase 09 UAT (09-HUMAN-UAT.md) — `testing`, 6 browser scenarios | doc-debt | v2.0 close |

Doc-status items acknowledged at milestone close: UAT/verification docs left un-flipped. Equivalent browser behaviors exercised live during Phase 10 two-account UAT (sign-in, sidebar, avatar, sharing all worked across two real Gmail accounts). No functional gaps — `tsc --noEmit` clean, 166 unit tests green (22 files), prod build green.

## Session Continuity

Last session: 2026-05-31 -- v2.0 milestone close
Stopped at: Milestone v2.0 archived, tagged, committed
Resume file: None
Next action: `/gsd-new-milestone`

## Decisions

- [Phase ?]: useListsStore() called without selector in LandingPage for mock-compatible test behavior
- [Phase ?]: CreateListForm delegates to listsStore.createList — owner_id NULL tech debt D-04 closed
- [Phase ?]: displayName = storedName ?? list?.name — store cache for live rename, local state fallback for direct URL nav (D-06/D-03)
- [Phase ?]: ProfileSection extracted as local sub-component; handleSignOut closes drawer before redirect (D-09)
- [Phase ?]: resolveDisplayName scoped as component-local helper in ListPage (display_name ?? full_name ?? name ?? email.split('@')[0] ?? 'Unknown')
- [Phase ?]: D-01: list_members composite PK (list_id, user_id) as idempotency layer 1 for membership
- [Phase ?]: D-02: SECURITY DEFINER is_list_member avoids RLS recursion; list_members own policies use direct column check only
- [Phase ?]: D-04: redeem_invite inserts auth.uid() only, never caller-supplied user_id, with ON CONFLICT DO NOTHING idempotency
- [Phase ?]: D-05: ShareBanner uses /invite/:code URL so partners receive redemption flow not blocked ListPage
- [Phase ?]: D-08: fetchLists drops owner_id filter; RLS membership policy gates rows; userId param kept as _userId for API compatibility

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
