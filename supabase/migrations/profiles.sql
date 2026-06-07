-- Phase 11: Profiles Foundation -- public.profiles table + handle_new_user trigger + backfill
--
-- Creates the public.profiles table synced from auth.users.
-- Prerequisites: auth.users exists (always true in Supabase).
-- Idempotent: CREATE TABLE IF NOT EXISTS; CREATE OR REPLACE FUNCTION;
--   DROP POLICY IF EXISTS before each CREATE POLICY.

-- ============================================================
-- SECTION 1: Table DDL
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz DEFAULT now()
);
-- Note: NO email column -- public SELECT USING (true) would leak it.
-- D-01 locked decision: email is excluded by design.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 2: RLS Policies
-- ============================================================
-- Uses (select auth.uid()) subselect form for initPlan query-planner optimization.
-- DROP POLICY IF EXISTS before each CREATE for idempotency.

-- SELECT: public read (anon + authenticated) -- safe because no email column
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- UPDATE: self only
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  TO authenticated
  USING ( id = (select auth.uid()) )
  WITH CHECK ( id = (select auth.uid()) );

-- INSERT: self only (client upsert path from authStore on sign-in)
-- INSERT policies require only WITH CHECK (no USING clause per Supabase RLS rules)
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ( id = (select auth.uid()) );

-- ============================================================
-- SECTION 3: handle_new_user Trigger
-- ============================================================
-- Fires on auth.users INSERT (new signup).
-- SECURITY DEFINER + SET search_path = '' -- canonical Supabase pattern (D-02).
-- All columns COALESCE-nullable -- Google OAuth may omit any field.
-- ON CONFLICT DO NOTHING -- trigger must NEVER throw (blocks user signup if it does).
-- DB column is raw_user_meta_data (not user_metadata -- that is the client-side key).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;  -- never let this throw; double-insert is safe
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- SECTION 4: Backfill
-- ============================================================
-- Mitch + wife have accounts created before this trigger was installed (D-03).
-- ON CONFLICT DO NOTHING ensures this is safe to re-run (idempotent).

INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'display_name',
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name'
  ),
  COALESCE(
    raw_user_meta_data->>'avatar_url',
    raw_user_meta_data->>'picture'
  )
FROM auth.users
ON CONFLICT (id) DO NOTHING;
