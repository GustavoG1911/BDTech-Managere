-- Production hardening for roles, centralized agenda/prospecção and Google tokens.

ALTER TABLE public.user_invitations
  ALTER COLUMN position DROP NOT NULL,
  ALTER COLUMN fixed_salary DROP NOT NULL,
  ALTER COLUMN commission_percent DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.profile_is_director_for_env(_user_id uuid, _is_test_data boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.position = 'Diretor'
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role
    OR OLD.position IS DISTINCT FROM NEW.position
    OR OLD.fixed_salary IS DISTINCT FROM NEW.fixed_salary
    OR OLD.commission_percent IS DISTINCT FROM NEW.commission_percent
    OR OLD.is_test_data IS DISTINCT FROM NEW.is_test_data
  THEN
    IF NOT public.profile_is_director_for_env(auth.uid(), COALESCE(OLD.is_test_data, NEW.is_test_data, false)) THEN
      RAISE EXCEPTION 'Apenas o Diretor pode alterar cargo, salário e comissão.';
    END IF;
  END IF;

  IF NEW.position IN ('Diretor', 'Executivo de Negócios', 'SDR') THEN
    NEW.role := 'user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

DROP POLICY IF EXISTS "profiles_admin_update_same_env" ON public.profiles;
DROP POLICY IF EXISTS "profiles_director_update_same_env" ON public.profiles;
CREATE POLICY "profiles_director_update_same_env"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.profile_is_director_for_env(auth.uid(), is_test_data)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.profile_is_director_for_env(auth.uid(), is_test_data)
  );

CREATE OR REPLACE FUNCTION public.notify_directors_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, is_test_data, is_read)
  SELECT
    director.user_id,
    'Novo usuário aguardando configuração',
    COALESCE(NEW.full_name, NEW.display_name, 'Novo usuário') || ' precisa de cargo, salário e comissão na Gestão de Equipe.',
    COALESCE(NEW.is_test_data, false),
    false
  FROM public.profiles director
  WHERE director.position = 'Diretor'
    AND COALESCE(director.is_test_data, false) = COALESCE(NEW.is_test_data, false)
    AND director.user_id <> NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_directors_new_profile_trg ON public.profiles;
CREATE TRIGGER notify_directors_new_profile_trg
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.position IS NULL OR NEW.fixed_salary IS NULL OR NEW.commission_percent IS NULL)
  EXECUTE FUNCTION public.notify_directors_new_profile();

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

UPDATE public.prospects p
SET is_test_data = COALESCE(owner_profile.is_test_data, false)
FROM public.profiles owner_profile
WHERE owner_profile.user_id = p.owner_id;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

UPDATE public.calendar_events e
SET is_test_data = COALESCE(owner_profile.is_test_data, false)
FROM public.profiles owner_profile
WHERE owner_profile.user_id = e.user_id;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all prospects" ON public.prospects;
DROP POLICY IF EXISTS "Users can insert prospects" ON public.prospects;
DROP POLICY IF EXISTS "Users can update their own prospects" ON public.prospects;
DROP POLICY IF EXISTS "Users can delete their own prospects" ON public.prospects;
DROP POLICY IF EXISTS "prospects_select" ON public.prospects;
DROP POLICY IF EXISTS "prospects_insert" ON public.prospects;
DROP POLICY IF EXISTS "prospects_update" ON public.prospects;
DROP POLICY IF EXISTS "prospects_delete" ON public.prospects;

CREATE POLICY "prospects_select_same_env"
  ON public.prospects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(prospects.is_test_data, false)
    )
  );

CREATE POLICY "prospects_insert_same_env"
  ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(prospects.is_test_data, false)
    )
  );

CREATE POLICY "prospects_update_same_env"
  ON public.prospects FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(prospects.is_test_data, false)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(prospects.is_test_data, false)
    )
  );

CREATE POLICY "prospects_delete_owner_or_director"
  ON public.prospects FOR DELETE TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.profile_is_director_for_env(auth.uid(), is_test_data)
  );

ALTER TABLE public.prospect_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all prospect notes" ON public.prospect_notes;
DROP POLICY IF EXISTS "Users can insert prospect notes" ON public.prospect_notes;
DROP POLICY IF EXISTS "prospect_notes_select" ON public.prospect_notes;
DROP POLICY IF EXISTS "prospect_notes_insert" ON public.prospect_notes;

CREATE POLICY "prospect_notes_select_same_env"
  ON public.prospect_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.prospects pr
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE pr.id = prospect_notes.prospect_id
        AND COALESCE(p.is_test_data, false) = COALESCE(pr.is_test_data, false)
    )
  );

CREATE POLICY "prospect_notes_insert_same_env"
  ON public.prospect_notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.prospects pr
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE pr.id = prospect_notes.prospect_id
        AND COALESCE(p.is_test_data, false) = COALESCE(pr.is_test_data, false)
    )
  );

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.calendar_events;

CREATE POLICY "calendar_events_select_same_env"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(calendar_events.is_test_data, false)
    )
  );

CREATE POLICY "calendar_events_insert_same_env"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(calendar_events.is_test_data, false)
    )
  );

CREATE POLICY "calendar_events_update_same_env"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(calendar_events.is_test_data, false)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(calendar_events.is_test_data, false)
    )
  );

CREATE POLICY "calendar_events_delete_same_env"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(calendar_events.is_test_data, false)
    )
  );

DROP POLICY IF EXISTS "admin_calendar_config_read" ON public.admin_calendar_config;
DROP VIEW IF EXISTS public.admin_calendar_status;
CREATE VIEW public.admin_calendar_status AS
SELECT id, google_email, sync_enabled, updated_at
FROM public.admin_calendar_config;
GRANT SELECT ON public.admin_calendar_status TO authenticated;
