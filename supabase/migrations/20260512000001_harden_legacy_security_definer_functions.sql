-- Harden legacy SECURITY DEFINER functions left by early migrations.
-- These functions exist in the current production database, but may be absent
-- when replaying migrations from a clean local/staging database.
DO $$
BEGIN
  IF to_regprocedure('public.get_user_role(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.get_user_role(uuid) SET search_path = public, pg_temp;
    REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
  END IF;

  IF to_regprocedure('public.notify_new_user()') IS NOT NULL THEN
    ALTER FUNCTION public.notify_new_user() SET search_path = public, pg_temp;
    REVOKE ALL ON FUNCTION public.notify_new_user() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
