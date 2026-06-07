-- Phase 11: Harden lists INSERT -- remove legacy null-owner branch (HARD-01)
--
-- Pre-flight: aborts if any null-owner lists exist (D-11).
-- Never edit lists_auth.sql (immutable history file).
--
-- This migration supersedes the lists_insert policy from lists_auth.sql via
-- DROP POLICY IF EXISTS + CREATE POLICY. lists_auth.sql is NOT edited.

-- ============================================================
-- SECTION 1: Pre-flight assertion
-- ============================================================
-- Aborts the migration with a descriptive error if any lists have owner_id IS NULL.
-- This guard ensures the new tightened policy will not silently block existing data.
-- Run: SELECT count(*) FROM lists WHERE owner_id IS NULL  before applying (STATE.md D-11).

DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT count(*) INTO null_count FROM public.lists WHERE owner_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      'HARD-01 pre-flight failed: % lists have null owner_id. '
      'Backfill owner_id before applying this migration.',
      null_count;
  END IF;
END $$;

-- ============================================================
-- SECTION 2: lists_insert policy replacement
-- ============================================================
-- Drop the Phase 6 policy that allowed owner_id IS NULL (anonymous list creation).
-- Replace with authenticated-only, auth.uid() = owner_id — no null branch.
-- Role change: 'anon, authenticated' → 'authenticated' only.
--   Rationale: No anonymous list creation paths exist in the client (D-10).
--   All new lists are created by authenticated users with auth.uid() as owner_id.
-- INSERT policy requires WITH CHECK only (no USING clause) per Supabase RLS INSERT rules.

DROP POLICY IF EXISTS "lists_insert" ON public.lists;
CREATE POLICY "lists_insert" ON public.lists FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = owner_id
  );

-- ============================================================
-- SECTION 3: items_insert verification (informational comment)
-- ============================================================
-- items_insert policy (items_membership.sql) confirmed null-free:
--   WITH CHECK uses:
--     list_id IN (SELECT id FROM lists WHERE owner_id = (select auth.uid()))
--     OR public.is_list_member(list_id)
-- No null branch present; no change required.
-- Confirmed by inspection of supabase/migrations/items_membership.sql.
