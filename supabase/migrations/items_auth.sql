-- Phase 6: Auth Foundation -- items table auth scaffolding (D-09/D-10)
--
-- Adds nullable user_id column to items table for authenticated user attribution.
-- Updates RLS policies to allow access for both anonymous legacy items (user_id IS NULL)
-- and items owned by authenticated users (user_id = auth.uid()).
--
-- Prerequisites: items table exists with RLS already enabled (Phase 1).
-- Idempotent: Uses IF EXISTS on all DROP POLICY statements.

-- Step 1: Add nullable user_id column with DEFAULT (select auth.uid())
-- DEFAULT ensures new items inserted by authenticated users automatically get their
-- user_id set at the database level, even if the application omits it in the INSERT.
-- Anonymous inserts (no auth session) will have user_id = NULL, which is correct.
ALTER TABLE items
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
  DEFAULT (select auth.uid());

-- Step 2: Drop ALL existing items policies
-- Covers v1.0 policies and any that may have been added in later phases.
-- IF EXISTS ensures idempotency if policies were already removed.
DROP POLICY IF EXISTS "anon_select_items" ON items;
DROP POLICY IF EXISTS "anon_insert_items" ON items;
DROP POLICY IF EXISTS "anon_update_items" ON items;
DROP POLICY IF EXISTS "anon_delete_items" ON items;

-- Step 3: Create new auth-aware policies
-- Pattern: user_id IS NULL (legacy anonymous items) OR authenticated user owns the item.
-- Uses (select auth.uid()) not bare auth.uid() for query planner initPlan optimization
-- (evaluated once per query, not once per row).
-- Granted to both anon and authenticated roles.

-- SELECT: read items that are unowned (legacy) or owned by the current user
CREATE POLICY "items_select" ON items FOR SELECT
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );

-- INSERT: allow inserting items with no owner (legacy) or owned by the current user
CREATE POLICY "items_insert" ON items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );

-- UPDATE: allow updating items that are unowned or owned by the current user
CREATE POLICY "items_update" ON items FOR UPDATE
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  )
  WITH CHECK (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );

-- DELETE: allow deleting items that are unowned or owned by the current user
CREATE POLICY "items_delete" ON items FOR DELETE
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (select auth.uid()) = user_id
  );
