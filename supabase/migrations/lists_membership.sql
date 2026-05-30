-- Phase 10: List Sharing -- widen lists RLS to owner-OR-member
--
-- Rewrites lists SELECT and UPDATE policies to allow access for:
--   (a) anonymous legacy lists (owner_id IS NULL),
--   (b) the authenticated user who owns the list,
--   (c) authenticated users who are members of the list (via is_list_member helper).
-- DELETE stays owner-only: members may not delete the list.
-- INSERT policy is unchanged: only owners create lists.
--
-- Prerequisites: list_members.sql must have been applied first
--   (is_list_member function must exist before these policies are created).
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.

-- ============================================================
-- lists SELECT: widen to owner OR member
-- ============================================================
-- Preserves owner_id IS NULL branch for legacy anonymous lists created before Phase 6.

DROP POLICY IF EXISTS "lists_select" ON public.lists;
CREATE POLICY "lists_select" ON public.lists FOR SELECT
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
    OR public.is_list_member(id)
  );

-- ============================================================
-- lists UPDATE: widen to owner OR member
-- ============================================================
-- Members may rename or update the shared list (same access as owner).
-- WITH CHECK mirrors USING to prevent privilege escalation via UPDATE.

DROP POLICY IF EXISTS "lists_update" ON public.lists;
CREATE POLICY "lists_update" ON public.lists FOR UPDATE
  TO authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
    OR public.is_list_member(id)
  )
  WITH CHECK (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
    OR public.is_list_member(id)
  );

-- ============================================================
-- lists DELETE: stays owner-only
-- ============================================================
-- DELETE stays owner-only: members may not delete the list.
-- No is_list_member branch here by design (D-02).

DROP POLICY IF EXISTS "lists_delete" ON public.lists;
CREATE POLICY "lists_delete" ON public.lists FOR DELETE
  TO authenticated
  USING (
    owner_id IS NULL
    OR (select auth.uid()) = owner_id
  );

-- INSERT policy unchanged: only owners create lists.
-- (lists_insert was created in lists_auth.sql and is not touched here.)
