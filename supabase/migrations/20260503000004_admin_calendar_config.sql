-- Centralized Google Calendar config (single row, owned by platform admin)
CREATE TABLE IF NOT EXISTS public.admin_calendar_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_email         TEXT,
  google_refresh_token TEXT,
  google_access_token  TEXT,
  google_token_expiry  TIMESTAMPTZ,
  sync_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_calendar_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (to check if sync is configured)
CREATE POLICY "admin_calendar_config_read"
  ON public.admin_calendar_config FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE only via service role key (Edge Functions)
