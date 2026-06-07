-- Phase 11: Member Management RPCs -- remove_member + leave_list SECURITY DEFINER functions
--
-- Both RPCs bypass RLS to modify list_members (no direct DELETE policy exists on list_members).
-- Authorization logic is internal to each function body.
-- Mirrors the redeem_invite pattern from items_membership.sql.
--
-- Prerequisites: public.lists exists; public.list_members exists; Supabase Realtime enabled.
-- Idempotent: CREATE OR REPLACE FUNCTION.

-- ============================================================
-- SECTION 1: remove_member
-- ============================================================
-- Called by the list owner to eject another member.
-- Security properties:
--   SECURITY DEFINER + SET search_path = '': runs as function owner, bypasses RLS.
--   auth.uid() for caller identity -- never a caller-supplied id (prevents spoofing).
--   Owner check: v_owner_id IS DISTINCT FROM auth.uid() raises before any mutation.
--   Self-remove guard: use leave_list instead.
--   Broadcasts member_removed on 'list-{listId}' channel -- topic matches client exactly (Pitfall 3).
--   GRANT EXECUTE TO authenticated only.

CREATE OR REPLACE FUNCTION public.remove_member(p_list_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM public.lists
  WHERE id = p_list_id;

  -- Enforce: only the list owner may remove members
  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Cannot remove yourself via this function (use leave_list instead)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'use leave_list to remove yourself';
  END IF;

  DELETE FROM public.list_members
  WHERE list_id = p_list_id
    AND user_id = p_user_id;

  -- Broadcast eject signal on the list channel.
  -- Topic 'list-' || p_list_id::text MUST match the client channel name exactly (Pitfall 3).
  -- Do NOT use 'items-' prefix -- that is a separate channel managed by itemsStore.
  PERFORM realtime.send(
    jsonb_build_object('user_id', p_user_id),
    'member_removed',
    'list-' || p_list_id::text,
    false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;

-- ============================================================
-- SECTION 2: leave_list
-- ============================================================
-- Called by a non-owner member to remove themselves from the list.
-- Security properties:
--   SECURITY DEFINER + SET search_path = '': bypasses RLS on list_members.
--   auth.uid() used for self-delete -- cannot delete another user's membership.
--   Owner guard: list owner cannot leave (must delete the list instead).
--   No broadcast needed -- self-leave is optimistic (client navigates away immediately, D-09).
--   GRANT EXECUTE TO authenticated only.

CREATE OR REPLACE FUNCTION public.leave_list(p_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- List owner cannot leave -- they must delete the list instead
  IF EXISTS (
    SELECT 1 FROM public.lists WHERE id = p_list_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'list owner cannot leave — delete the list instead';
  END IF;

  DELETE FROM public.list_members
  WHERE list_id = p_list_id
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_list(uuid) TO authenticated;
