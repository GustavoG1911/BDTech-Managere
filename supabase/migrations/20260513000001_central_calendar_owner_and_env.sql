ALTER TABLE public.admin_calendar_config
  ADD COLUMN IF NOT EXISTS connected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

UPDATE public.admin_calendar_config config
SET connected_by_user_id = (
  SELECT profile.user_id
  FROM public.profiles profile
  WHERE profile.role = 'admin'
    AND COALESCE(profile.is_test_data, false) = COALESCE(config.is_test_data, false)
  ORDER BY profile.created_at NULLS LAST
  LIMIT 1
)
WHERE config.connected_by_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_calendar_config_env_uidx
  ON public.admin_calendar_config (is_test_data);

DROP VIEW IF EXISTS public.admin_calendar_status;
CREATE VIEW public.admin_calendar_status AS
SELECT id, google_email, sync_enabled, updated_at, connected_by_user_id, is_test_data
FROM public.admin_calendar_config
WHERE COALESCE((auth.jwt() ->> 'email') ILIKE '%@teste.com', false) = COALESCE(is_test_data, false);

GRANT SELECT ON public.admin_calendar_status TO authenticated;
