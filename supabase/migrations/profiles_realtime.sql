-- Phase 11 gap-closure: Add public.profiles to supabase_realtime publication (T2 / PROF-05)
-- Root cause: only public.items was in supabase_realtime; profiles UPDATE events were
--   never replicated to Realtime, so profilesStore.ts:57-74 postgres_changes subscription
--   never fired.
-- REPLICA IDENTITY: default (PK = id) is sufficient for UPDATE payloads to carry the id
--   column, which is all profilesStore.patch() needs to identify which profile to update.
-- profiles_select RLS is USING(true) so Realtime RLS check passes for all authed users.

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
