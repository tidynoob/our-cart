-- Phase 10: List Sharing -- list membership table, is_list_member helper, list_members RLS
--
-- Creates the list_members join table that tracks which users are members of which lists.
-- Provides the is_list_member SECURITY DEFINER helper used by lists and items policies.
-- Provides RLS policies for list_members itself (SELECT only -- no direct INSERT allowed).
--
-- Prerequisites: lists table exists; auth.users exists.
-- Idempotent: Uses IF EXISTS on DROP POLICY statements; CREATE TABLE IF NOT EXISTS;
--   CREATE OR REPLACE FUNCTION.

-- ============================================================
-- SECTION 1: Table DDL
-- ============================================================

CREATE TABLE IF NOT EXISTS public.list_members (
  list_id    uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);

ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 2: is_list_member SECURITY DEFINER helper
-- ============================================================
-- Called by lists and items policies to check membership.
-- SECURITY DEFINER: runs as the function owner (bypasses RLS on list_members),
--   preventing infinite recursion when policies on lists/items call this function.
-- STABLE: read-only; allows query planner to cache the result within a query.
-- SET search_path = '': prevents search_path injection attacks.
-- GRANT EXECUTE TO authenticated only: anon role cannot call this function.
-- CRITICAL: This function must NOT be called from list_members' own policies
--   (that would cause infinite recursion: policy -> function -> list_members -> policy).

CREATE OR REPLACE FUNCTION public.is_list_member(p_list_id uuid)
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
      AND user_id = (SELECT auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_list_member(uuid) TO authenticated;

-- ============================================================
-- SECTION 3: list_members RLS policies
-- ============================================================
-- SELECT policy uses direct column check only -- does NOT call is_list_member
-- (calling it here would cause infinite recursion: list_members policy -> is_list_member
--  -> SELECT from list_members -> policy -> ...).
-- Uses (select auth.uid()) subselect form for initPlan query-planner optimization.

DROP POLICY IF EXISTS "list_members_select" ON public.list_members;
CREATE POLICY "list_members_select" ON public.list_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR list_id IN (
      SELECT id FROM public.lists WHERE owner_id = (select auth.uid())
    )
  );

-- No INSERT policy: direct inserts are closed for all roles.
-- Only the redeem_invite SECURITY DEFINER function (in items_membership.sql) may insert
-- into list_members. This blocks direct REST API inserts from any client.
