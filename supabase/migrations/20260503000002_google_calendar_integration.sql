-- Google Calendar Integration
-- Adds OAuth token storage to profiles and external_id to calendar_events

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_email         TEXT,
  ADD COLUMN IF NOT EXISTS google_sync_enabled  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS source          TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_events_google_event_id
  ON public.calendar_events (user_id, google_event_id)
  WHERE google_event_id IS NOT NULL;
