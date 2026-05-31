---
phase: 10-list-sharing
plan: "06"
type: execute
gap_closure: true
status: complete
completed_at: 2026-05-30
requirements:
  - SHARE-01
files_modified:
  - supabase/migrations/lists_membership.sql
  - supabase/migrations/items_membership.sql
---

# 10-06 Summary — RLS null-owner data-isolation leak closed

## Objective

Close UAT Test 1 major failure: authenticated users saw every `owner_id IS NULL`
list across both Gmail accounts. Root cause (see `.planning/debug/null-owner-list-leak.md`):
unconditional `owner_id IS NULL` branch in lists/items RLS USING clauses — D-08 removed
the app-side owner filter that had masked it, leaving RLS the sole gate.

## What was done

### Task 1 — Resolve legacy null-owner rows (live DB)
Audited via Supabase MCP: 11 null-owner lists (all test/dev names) + 13 items, vs 4 properly
owned lists. User chose **delete all**. Deleted 13 items + 11 lists (and any membership rows)
in one transaction. Result: 0 null-owner lists remain, 4 owned lists, 1 item.

### Task 2 — Rewrite migration files
Removed the unconditional `owner_id IS NULL` branch from:
- `lists_membership.sql`: lists_select / lists_update (USING + WITH CHECK) / lists_delete
- `items_membership.sql`: items_select / items_insert / items_update / items_delete
Every surviving branch scopes by `(select auth.uid())` or `is_list_member`. `redeem_invite`
SECURITY DEFINER function untouched. `npx tsc --noEmit` → exit 0.

### Task 3 — Apply to live DB
Applied corrected policies directly via MCP `execute_sql` (not manual SQL Editor — MCP available).
Verified against `pg_policies`: zero `owner_id IS NULL` in any lists/items SELECT/UPDATE/DELETE
qual or with_check.

### Task 4 — Isolation verification
Proved at RLS level by impersonating each `auth.uid()` (`SET LOCAL request.jwt.claims`):
- mitchell sees: trial check (own), trial check 2 (own/shared), phase 10 list (own/shared) — NOT goinc
- incorporatedgo sees: goinc (own), trial check 2 (member), phase 10 list (member) — NOT trial check
No cross-account leakage; shared (membership) lists visible to both. UAT Test 1 logic passes.

## Residual / follow-ups (out of 10-06 scope)

- **`lists_insert` WITH CHECK still allows `owner_id IS NULL`** (from `lists_auth.sql`). Not a
  read leak — null rows can no longer be SELECTed — but permits creating orphan null-owner rows.
  App always sets owner_id (D-04), so not reachable via UI. Tighten in a follow-up.
- **`lists_auth.sql` retains the old null-owner branches** in its policy bodies. Dead because
  `lists_membership.sql` DROPs + recreates those policies and is applied after. Harmless as long
  as migration order is preserved; consider editing for source-of-truth consistency.

## Verification

- grep `owner_id IS NULL` in both membership files → matches only in comments, none in USING/WITH CHECK ✓
- Live `pg_policies` confirms corrected clauses ✓
- Per-account RLS impersonation confirms isolation ✓
- `npx tsc --noEmit` exit 0 ✓
