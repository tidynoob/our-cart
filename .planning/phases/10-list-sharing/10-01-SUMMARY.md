---
phase: 10-list-sharing
plan: "01"
subsystem: database/migrations
tags: [rls, membership, security-definer, migrations, sql]
dependency_graph:
  requires: [09-auth-integration]
  provides: [list_members-table, is_list_member-helper, redeem_invite-rpc, widened-lists-rls, widened-items-rls]
  affects: [supabase/migrations]
tech_stack:
  added: []
  patterns: [SECURITY DEFINER functions, SET search_path injection guard, DROP POLICY IF EXISTS idempotency, (select auth.uid()) initPlan optimization, composite PK idempotency, ON CONFLICT DO NOTHING idempotency]
key_files:
  created:
    - supabase/migrations/list_members.sql
    - supabase/migrations/lists_membership.sql
    - supabase/migrations/items_membership.sql
  modified: []
decisions:
  - "D-01: list_members composite PK (list_id, user_id) as idempotency layer 1"
  - "D-02: SECURITY DEFINER is_list_member helper avoids RLS recursion while enabling owner-OR-member policies on lists and items"
  - "D-04: redeem_invite inserts auth.uid() only — never caller-supplied user_id — preventing privilege escalation"
  - "D-07: ON CONFLICT DO NOTHING as idempotency layer 2 for re-redemption safety"
  - "list_members own SELECT policy avoids calling is_list_member (would recurse); uses direct column check + owner subquery"
metrics:
  duration: "< 15 minutes"
  completed_date: "2026-05-30"
  tasks: 3
  files_created: 3
  files_modified: 0
---

# Phase 10 Plan 01: SQL Migrations — Membership Model Summary

**One-liner:** Three migration files establishing list_members table, SECURITY DEFINER is_list_member helper, and owner-OR-member RLS rewrites for lists and items, plus redeem_invite RPC.

## What Was Built

Three SQL migration files that form a dependency-ordered chain:

**`supabase/migrations/list_members.sql`** — Foundation layer:
- `public.list_members` table with composite PK `(list_id, user_id)`, ON DELETE CASCADE on both FKs
- `is_list_member(uuid) RETURNS boolean` — SECURITY DEFINER, STABLE, SET search_path = '', GRANT EXECUTE TO authenticated
- `list_members` SELECT policy using only direct column check (no is_list_member call — recursion prevention)
- No INSERT policy — direct REST inserts blocked for all roles

**`supabase/migrations/lists_membership.sql`** — Lists RLS widening:
- `lists_select` and `lists_update` rewritten with third OR branch: `public.is_list_member(id)`
- `lists_delete` stays owner-only (no member branch)
- `lists_insert` untouched
- All DROP POLICY IF EXISTS before each CREATE POLICY

**`supabase/migrations/items_membership.sql`** — Items RLS widening + invite function:
- All four items policies rewritten: three-branch USING (legacy anon, owner, member via `public.is_list_member(list_id)`)
- `redeem_invite(text) RETURNS json` — SECURITY DEFINER, SET search_path = '', ON CONFLICT DO NOTHING, GRANT TO authenticated only
- Returns `{list_id, share_code}` on success, NULL for unknown share_code

## Deviations from Plan

None — plan executed exactly as written.

## Security Properties Verified

| Threat | Mitigation | File |
|--------|-----------|------|
| T-10-01: Info disclosure via SELECT | is_list_member + owner-OR-member policies return zero rows to non-members | lists_membership.sql, items_membership.sql |
| T-10-02: EoP via redeem_invite | auth.uid() in INSERT (not caller-supplied), GRANT TO authenticated only | items_membership.sql |
| T-10-03: EoP via is_list_member | SET search_path = '' on both SECURITY DEFINER functions | list_members.sql, items_membership.sql |
| T-10-05: Direct list_members INSERT | No INSERT policy on list_members table | list_members.sql |
| T-10-06: RLS recursion | list_members policies use direct column check, never call is_list_member | list_members.sql |

## Commit History

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 6a26124 | feat(10-01): add list_members table + is_list_member helper + list_members RLS |
| 2 | 43d7cb7 | feat(10-01): widen lists RLS to owner-OR-member via is_list_member |
| 3 | 809f3f8 | feat(10-01): widen items RLS to owner-OR-member + add redeem_invite function |

## Known Stubs

None — these are pure SQL migration files with no UI or application-layer stubs.

## Self-Check: PASSED
