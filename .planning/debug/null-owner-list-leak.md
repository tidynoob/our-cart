---
status: diagnosed
trigger: "lists are loading, but both my gmail accounts can see all the lists from supabase that have null owner_id"
created: 2026-05-30T22:00:00Z
updated: 2026-05-30T22:05:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — `owner_id IS NULL` branch in lists_select RLS USING clause exposes all legacy null-owner rows to every authenticated user. D-08 removed the app-side owner filter that had masked the leak.
test: Read lists_select policy USING expression + listsStore.fetchLists query.
expecting: Policy grants SELECT when owner_id IS NULL (unconditional), and fetchLists no longer filters by owner_id.
next_action: Return diagnosis to /gsd-plan-phase --gaps. Do NOT fix.

## Symptoms

expected: After login, an authenticated user sees only their own lists + lists they joined via invite. Each Gmail account sees only its own + member lists.
actual: Both Gmail accounts see every list whose owner_id is NULL.
errors: None reported.
reproduction: Phase 10 UAT Test 1 — log in with either of two Gmail accounts; both see all null-owner_id lists.
started: Discovered during Phase 10 (list-sharing) UAT. Unmasked by 10-04 D-08.

## Eliminated

- hypothesis: App-side filter in fetchLists is the leak source.
  evidence: fetchLists (listsStore.ts:22-36) has NO owner_id filter — it was removed in D-08. The leak is downstream of the query, in RLS itself. The query relies entirely on RLS to gate rows, so the policy is the sole gate.
  timestamp: 2026-05-30T22:03:00Z

## Evidence

- timestamp: 2026-05-30T22:01:00Z
  checked: supabase/migrations/lists_membership.sql lines 19-26 (lists_select policy)
  found: USING clause is `owner_id IS NULL OR (select auth.uid()) = owner_id OR public.is_list_member(id)`. The first branch `owner_id IS NULL` is unconditional — it does NOT reference auth.uid(), so it is TRUE for every caller (anon AND authenticated) on any row whose owner_id is NULL.
  implication: Every authenticated user can SELECT every null-owner list. This is the leak.

- timestamp: 2026-05-30T22:02:00Z
  checked: src/stores/listsStore.ts lines 22-36 (fetchLists)
  found: Query is `supabase.from('lists').select(...).order('created_at')` with NO `.eq('owner_id', userId)`. Comment on line 23: "_userId kept for API compatibility — RLS now handles access filtering (D-08)". 
  implication: D-08 removed the app-side owner filter. Previously this filter clipped null-owner rows out of the result client-side, hiding the RLS over-permission. With it gone, RLS is the only gate — and RLS lets null-owner rows through to all authenticated users.

- timestamp: 2026-05-30T22:03:00Z
  checked: supabase/migrations/items_membership.sql lines 26-33 (items_select)
  found: Same pattern — `list_id IN (SELECT id FROM public.lists WHERE owner_id IS NULL) OR ...`. Items on null-owner lists are likewise exposed to all authenticated users (secondary leak: the items belonging to those leaked lists).
  implication: Fix must consider items policies too, or the leaked lists' items remain visible.

- timestamp: 2026-05-30T22:04:00Z
  checked: .planning/phases/10-list-sharing/10-UAT.md lines 15-19
  found: Test 1 result "issue" / severity major. Verbatim: "both my gmail accounts can see all the lists from supabase that have null owner_id". Matches the policy behavior exactly — only NULL-owner rows leak, not other users' owned rows.
  implication: Symptom precisely matches the `owner_id IS NULL` branch. Owned rows are correctly scoped (auth.uid() = owner_id); only the null-owner legacy branch over-shares.

## Resolution

root_cause: |
  The lists_select RLS policy includes an unconditional legacy branch `owner_id IS NULL`
  in its USING clause (supabase/migrations/lists_membership.sql:22-26):

    USING (
      owner_id IS NULL
      OR (select auth.uid()) = owner_id
      OR public.is_list_member(id)
    )

  The `owner_id IS NULL` branch was intended to preserve access to pre-Phase-6 legacy
  anonymous lists, but it does not scope by user — it grants SELECT on EVERY null-owner row
  to EVERY caller (anon + authenticated). Before Phase 10, the app-side filter
  `.eq('owner_id', userId)` in fetchLists clipped these rows out client-side, so the
  over-permission was never observable. Phase 10 D-08 removed that filter (listsStore.ts:22-36),
  leaving RLS as the sole gate. The unconditional null-owner branch now leaks all legacy
  null-owner lists across all authenticated accounts. The same `owner_id IS NULL` branch
  exists in the items policies (items_membership.sql:30,40,50,55,65), so items on those
  leaked lists are exposed too.
fix: ""   # not applied — find_root_cause_only mode
verification: ""
files_changed: []
