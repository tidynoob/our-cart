-- Phase 13: Enhanced Items -- append-only column add + position backfill (D-01/D-11)
--
-- Adds two nullable text columns to public.items:
--   note     -- free-text note per item (ITEM-01)
--   position -- lexicographic fractional-index reorder key (ITEM-02)
-- Then backfills `position` for all existing rows in created_at order so none
-- stay null (Pitfall 2). Keys are zero-padded ('a0000', 'a0001', ...) so
-- lexicographic order equals insertion order and interleaves correctly with
-- future client-generated generateKeyBetween() keys (A3).
--
-- Prerequisites: items table exists (items_auth.sql). Idempotent via IF NOT EXISTS
--   on the column adds and WHERE position IS NULL on the backfill (safe to re-run).
-- No RLS change (D-02): items_update is already membership-gated (items_membership.sql).
-- No publication change: public.items is already in supabase_realtime; adding
--   columns to a published table needs no re-add — UPDATE payloads carry them (A1).

-- Step 1: Add the two nullable text columns (idempotent).
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS position text;

-- Step 2: Backfill `position` for existing rows in global created_at order.
-- Zero-padded suffix sorts lexicographically == numeric for up to 9999 rows
-- (far beyond a 2-person list). Idempotent: only touches rows where position IS NULL.
DO $$
DECLARE
  r record;
  i int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.items WHERE position IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE public.items SET position = 'a' || lpad(i::text, 4, '0') WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;
