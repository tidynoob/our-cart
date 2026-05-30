-- Phase 10: List Sharing -- widen items RLS to all items on accessible lists; add redeem_invite
--
-- Rewrites all four items policies to grant access to items whose list_id is accessible to
-- the current user (as owner or as a member). Three-branch USING shape:
--   (a) legacy anonymous lists (owner_id IS NULL),
--   (b) lists owned by the current user,
--   (c) lists the current user is a member of (via is_list_member helper).
--
-- Also adds the redeem_invite SECURITY DEFINER function that handles invite link redemption.
--
-- Prerequisites:
--   - list_members.sql (public.list_members table + public.is_list_member helper must exist)
--   - lists_membership.sql (widened lists SELECT must exist for consistent access model)
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY;
--   CREATE OR REPLACE FUNCTION for redeem_invite.

-- ============================================================
-- SECTION 1: Widened items policies
-- ============================================================
-- All four operations use the same three-branch access shape based on list_id.
-- Items belong to their list; if you can access the list, you can access its items.
-- Uses (select auth.uid()) subselect form for initPlan query-planner optimization.
-- Retains TO anon, authenticated role grants from existing items policies.

-- SELECT: read items on accessible lists
DROP POLICY IF EXISTS "items_select" ON public.items;
CREATE POLICY "items_select" ON public.items FOR SELECT
  TO anon, authenticated
  USING (
    list_id IN (SELECT id FROM public.lists WHERE owner_id IS NULL)
    OR list_id IN (SELECT id FROM public.lists WHERE owner_id = (select auth.uid()))
    OR public.is_list_member(list_id)
  );

-- INSERT: add items to accessible lists (WITH CHECK only -- no USING for INSERT)
DROP POLICY IF EXISTS "items_insert" ON public.items;
CREATE POLICY "items_insert" ON public.items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    list_id IN (SELECT id FROM public.lists WHERE owner_id IS NULL)
    OR list_id IN (SELECT id FROM public.lists WHERE owner_id = (select auth.uid()))
    OR public.is_list_member(list_id)
  );

-- UPDATE: modify items on accessible lists (USING + WITH CHECK)
DROP POLICY IF EXISTS "items_update" ON public.items;
CREATE POLICY "items_update" ON public.items FOR UPDATE
  TO anon, authenticated
  USING (
    list_id IN (SELECT id FROM public.lists WHERE owner_id IS NULL)
    OR list_id IN (SELECT id FROM public.lists WHERE owner_id = (select auth.uid()))
    OR public.is_list_member(list_id)
  )
  WITH CHECK (
    list_id IN (SELECT id FROM public.lists WHERE owner_id IS NULL)
    OR list_id IN (SELECT id FROM public.lists WHERE owner_id = (select auth.uid()))
    OR public.is_list_member(list_id)
  );

-- DELETE: remove items from accessible lists
DROP POLICY IF EXISTS "items_delete" ON public.items;
CREATE POLICY "items_delete" ON public.items FOR DELETE
  TO anon, authenticated
  USING (
    list_id IN (SELECT id FROM public.lists WHERE owner_id IS NULL)
    OR list_id IN (SELECT id FROM public.lists WHERE owner_id = (select auth.uid()))
    OR public.is_list_member(list_id)
  );

-- ============================================================
-- SECTION 2: redeem_invite SECURITY DEFINER function
-- ============================================================
-- Called by authenticated clients via supabase.rpc('redeem_invite', { p_share_code })
-- to join a list using a share link.
--
-- Security properties:
--   SECURITY DEFINER: runs as function owner, bypassing RLS to insert into list_members.
--   SET search_path = '': prevents search_path injection attacks.
--   auth.uid() inside body: inserts membership for the JWT caller only -- never a
--     caller-supplied user_id -- preventing privilege escalation (T-10-02).
--   ON CONFLICT DO NOTHING: idempotent; re-redeeming the same link is safe (D-07).
--   GRANT EXECUTE TO authenticated only: anon role cannot redeem invites.
--
-- Returns: json { list_id, share_code } on success, NULL for unknown share_code.

CREATE OR REPLACE FUNCTION public.redeem_invite(p_share_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list_id    uuid;
  v_share_code text;
BEGIN
  SELECT id, share_code
  INTO v_list_id, v_share_code
  FROM public.lists
  WHERE share_code = p_share_code
  LIMIT 1;

  IF v_list_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.list_members (list_id, user_id)
  VALUES (v_list_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('list_id', v_list_id, 'share_code', v_share_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
