-- Phase 11 gap-closure: Broaden list_members SELECT policy (T1 / PROF-04, T3 / MEMBER-01, T4 / MEMBER-02)
-- Root cause: the existing list_members_select policy USING (user_id = auth.uid() OR list owner)
--   allows a non-owner member to read only their OWN membership row. profilesStore.loadForList
--   derives memberIds from list_members, so non-owner viewers only load their own profile.
-- Fix: any list member may read ALL member rows of that list.
-- CRITICAL: calling is_list_member() from list_members' own policy would cause RLS infinite
--   recursion (policy -> function -> SELECT list_members -> policy ...).
--   Solution: a separate SECURITY DEFINER helper is_list_member_for_rls(p_list_id, p_uid)
--   that accepts the user_id as an explicit argument and performs a single direct lookup.
--   It is named differently from the existing is_list_member(uuid) to prevent accidental
--   cross-use between list_members policies and other table policies.

-- ============================================================
-- SECTION 1: SECURITY DEFINER helper (avoids recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_list_member_for_rls(p_list_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.list_members
    WHERE list_id = p_list_id
      AND user_id = p_uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_list_member_for_rls(uuid, uuid) TO authenticated;

-- ============================================================
-- SECTION 2: Replace list_members_select policy
-- ============================================================
-- The new USING predicate lets any authenticated list member read all member rows
-- for lists they belong to. The SECURITY DEFINER function performs the lookup without
-- triggering the policy on list_members (no recursion). Owner access is preserved because
-- the owner is always a member (redeem_invite inserts owner on list creation).

DROP POLICY IF EXISTS "list_members_select" ON public.list_members;
CREATE POLICY "list_members_select" ON public.list_members FOR SELECT
  TO authenticated
  USING (
    public.is_list_member_for_rls(list_id, (SELECT auth.uid()))
  );
