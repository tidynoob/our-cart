---
phase: 10-list-sharing
status: complete
completed: 2026-05-31
requirements: [SHARE-01, SHARE-02]
plans: ["00", "01", "02", "03", "04", "06"]
uat_outcome: 6/6 pass
---

# Phase 10 — List Sharing: Phase Summary

## Goal

Two users can share a single grocery list: owner copies an `/invite/<code>` link, partner opens it (signing in if needed), redeems via RPC, lands on the list, and sees realtime updates. RLS enforces membership-based access.

## What shipped

| Plan | Scope | Status |
|------|-------|--------|
| 10-00 | Wave 0 test stubs — `InvitePage.test.tsx`, `ShareBanner.test.tsx` | ✅ |
| 10-01 | `redeem_invite` RPC migration + `list_members` RLS | ✅ |
| 10-02 | `InvitePage` route — spinner → redirect / invalid-state | ✅ |
| 10-03 | `ShareBanner` — copy `/invite/<code>` URL | ✅ |
| 10-04 | `fetchLists` membership scoping; D-08 removed app-side owner filter | ✅ |
| 10-06 | Gap closure — RLS null-owner data-isolation leak | ✅ |

(10-05 plan slot unused — work folded into 10-04.)

## UAT outcome

6/6 pass after 10-06 remediation. Original Test 1 failure (cross-account list visibility) traced to `owner_id IS NULL` unconditional branch in lists/items RLS that D-08 had unmasked. Closed in commit `f5514b5`: branch removed from all six policies; 11 legacy null-owner lists + 13 items deleted. Browser re-test confirmed each account sees only own + member lists.

## Key decisions captured

- **D-03**: `InvitePage` calls `supabase.rpc('redeem_invite')` directly — thin route, no store action.
- **D-04**: App always sets `owner_id` on insert (defense in depth alongside RLS).
- **D-08**: Removed `.eq('owner_id')` app-side filter from `listsStore.fetchLists` — RLS is the sole gate.
- **10-06**: `lists_insert` WITH CHECK still permits `owner_id IS NULL` (from `lists_auth.sql`). Not a read leak; not reachable via UI. Tighten in a follow-up.
- **10-06**: `lists_auth.sql` retains old null-owner branches dead-code (overwritten by `lists_membership.sql` applied after). Source-of-truth cleanup deferred.

## Residual / follow-ups

1. Tighten `lists_insert` WITH CHECK to forbid `owner_id IS NULL`.
2. Edit `lists_auth.sql` to remove dead null-owner branches for source-of-truth consistency.

## Verification

- All plan SUMMARYs marked complete.
- `npx tsc --noEmit` → exit 0 (per 10-06).
- Live `pg_policies` confirms zero `owner_id IS NULL` in lists/items SELECT/UPDATE/DELETE qual/with_check.
- Manual UAT 6/6 pass.
