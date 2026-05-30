# 10-02 SUMMARY — Apply Phase 10 migrations to live Supabase

**Plan:** 10-02 (wave 2) · **Status:** Complete · **Mode:** human-action gate (manual apply)

## What happened

`supabase db push` could not run inside the GSD execution environment (no Supabase CLI, no linked project, no access token). Per the plan's `autonomous: false` contract, the push was delegated to the human operator. The user applied the three migration files to the live Supabase database and verified the result.

## Applied (in dependency order)

1. `supabase/migrations/list_members.sql` — `list_members` table (composite PK list_id,user_id) + `is_list_member()` SECURITY DEFINER helper + non-recursive `list_members` RLS
2. `supabase/migrations/lists_membership.sql` — `lists` SELECT/UPDATE widened to owner-OR-member; DELETE owner-only
3. `supabase/migrations/items_membership.sql` — all four `items` policies widened to membership; `redeem_invite()` SECURITY DEFINER function

## Verification (operator-confirmed)

- User selected "Yes — applied & verified" at the Wave 2 checkpoint.
- `list_members` table present with columns list_id, user_id, created_at.
- `is_list_member` + `redeem_invite` present in `public` schema, Security = DEFINER.
- `lists_select` policy now references membership (no longer owner-only).
- Smoke test: `SELECT public.redeem_invite('NOTEXIST');` returns NULL (function exists, handles unknown codes).

## Self-Check: PASSED

Live schema matches the migration files. Wave 3 (app code) is unblocked.

## Key files

- created (live DB objects): `list_members`, `is_list_member()`, `redeem_invite()`; rewritten `lists`/`items` RLS
- no source files changed in this plan (files were authored in 10-01; this plan applies them)

## Notes / deviations

- Push executed manually rather than via `supabase db push` — environment lacked the CLI/credentials. Functionally equivalent: same SQL, same target DB.
