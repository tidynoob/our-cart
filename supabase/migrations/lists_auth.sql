-- Phase 6: Auth Foundation -- lists table auth scaffolding (D-11)
--
-- Adds nullable owner_id column to lists table for list ownership.
-- Updates RLS policies to allow access for both anonymous legacy lists (owner_id IS NULL)
-- and lists owned by authenticated users (owner_id = auth.uid()).
--
-- Prerequisites: lists table exists with RLS already enabled (Phase 1).
-- Idempotent: Uses IF EXISTS on all DROP POLICY statements.
-- Note: No DEFAULT on owner_id -- lists are created in application code, which will
-- pass owner_id explicitly in Phase 7.

-- Step 1: Add nullable owner_id column (no DEFAULT)
ALTER TABLE lists
  ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Drop ALL existing lists policies
-- Covers v1.0 policies and any that may have been added in later phases.
-- IF EXISTS ensures idempotency if policies were already removed.
DROP POLICY IF EXISTS "anon_select_lists" ON lists;
DROP POLICY IF EXISTS "anon_insert_lists" ON lists;
DROP POLICY IF EXISTS "anon_update_lists" ON lists;
DROP POLICY IF EXISTS "anon_delete_lists" ON lists;

-- Step 3: Create new auth-aware policies
-- Pattern: owner_id IS NULL (legacy anonymous lists) OR authenticated user owns the list.
-- Uses (select auth.uid()) not bare auth.uid() for query planner initPlan optimization
-- (evaluated once per query, not once per row).
-- Granted to both anon and authenticated roles.

-- SELECT: read lists that are unowned (legacy) or owned by the current user
CREATE POLICY "lists_select" ON lists FOR SELECT
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );

-- INSERT: allow inserting lists with no owner (legacy) or owned by the current user
CREATE POLICY "lists_insert" ON lists FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );

-- UPDATE: allow updating lists that are unowned or owned by the current user
CREATE POLICY "lists_update" ON lists FOR UPDATE
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  )
  WITH CHECK (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );

-- DELETE: allow deleting lists that are unowned or owned by the current user
-- Preserves the same permissive pattern as other policies.
-- Phase 7 may tighten this with proper ownership verification.
CREATE POLICY "lists_delete" ON lists FOR DELETE
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );
