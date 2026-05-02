-- Fluxo de administração e convites.
-- O role continua sendo permissão de sistema; position continua sendo cargo operacional.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS fixed_salary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_percent numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.profile_has_role_for_env(
  _user_id uuid,
  _role text,
  _is_test_data boolean
)
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
      AND p.role = _role
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  position text NOT NULL CHECK (position IN ('Diretor', 'Executivo de Negócios', 'SDR')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'gestor', 'user')),
  fixed_salary numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_test_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_pending_email_env_uidx
  ON public.user_invitations (LOWER(email), is_test_data)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS user_invitations_status_created_idx
  ON public.user_invitations (status, created_at DESC);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_invitations_admin_select" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_admin_insert" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_admin_update" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_admin_delete" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_recipient_select" ON public.user_invitations;

CREATE POLICY "user_invitations_admin_select"
  ON public.user_invitations
  FOR SELECT
  TO authenticated
  USING (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data));

CREATE POLICY "user_invitations_admin_insert"
  ON public.user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data));

CREATE POLICY "user_invitations_admin_update"
  ON public.user_invitations
  FOR UPDATE
  TO authenticated
  USING (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data))
  WITH CHECK (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data));

CREATE POLICY "user_invitations_admin_delete"
  ON public.user_invitations
  FOR DELETE
  TO authenticated
  USING (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data));

CREATE POLICY "user_invitations_recipient_select"
  ON public.user_invitations
  FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "profiles_admin_select_same_env" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update_same_env" ON public.profiles;

CREATE POLICY "profiles_admin_select_same_env"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data));

CREATE POLICY "profiles_admin_update_same_env"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data))
  WITH CHECK (public.profile_has_role_for_env(auth.uid(), 'admin', is_test_data));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_invite public.user_invitations%ROWTYPE;
  user_is_test boolean := COALESCE(NEW.email, '') ILIKE '%@teste.com';
  display text := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email);
BEGIN
  SELECT *
  INTO pending_invite
  FROM public.user_invitations
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status = 'pending'
    AND is_test_data = user_is_test
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.profiles (
    user_id,
    display_name,
    full_name,
    role,
    position,
    job_title,
    fixed_salary,
    commission_percent,
    is_test_data
  )
  VALUES (
    NEW.id,
    display,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(pending_invite.role, 'user'),
    pending_invite.position,
    pending_invite.position,
    COALESCE(pending_invite.fixed_salary, 0),
    COALESCE(pending_invite.commission_percent, 20),
    user_is_test
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    position = COALESCE(public.profiles.position, EXCLUDED.position),
    job_title = COALESCE(public.profiles.job_title, EXCLUDED.job_title),
    fixed_salary = COALESCE(public.profiles.fixed_salary, EXCLUDED.fixed_salary),
    commission_percent = COALESCE(public.profiles.commission_percent, EXCLUDED.commission_percent),
    is_test_data = EXCLUDED.is_test_data;

  IF pending_invite.id IS NOT NULL THEN
    UPDATE public.user_invitations
    SET status = 'accepted',
        accepted_by = NEW.id,
        accepted_at = now(),
        updated_at = now()
    WHERE id = pending_invite.id;
  END IF;

  RETURN NEW;
END;
$$;
