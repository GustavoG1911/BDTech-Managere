-- Diretor e demais cargos operacionais nao sao admins de sistema.
-- A permissao operacional continua vindo de profiles.position.

UPDATE public.profiles
SET role = 'user'
WHERE position IN ('Diretor', 'Executivo de Negócios', 'SDR')
  AND role = 'admin';

UPDATE public.user_invitations
SET role = 'user',
    updated_at = now()
WHERE position IN ('Diretor', 'Executivo de Negócios', 'SDR')
  AND role <> 'user'
  AND status = 'pending';

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
      AND (
        _role <> 'admin'
        OR p.position IS NULL
        OR p.position NOT IN ('Diretor', 'Executivo de Negócios', 'SDR')
      )
  )
$$;

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
  invited_role text := 'user';
BEGIN
  SELECT *
  INTO pending_invite
  FROM public.user_invitations
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status = 'pending'
    AND is_test_data = user_is_test
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_invite.id IS NOT NULL AND pending_invite.position IS NULL THEN
    invited_role := COALESCE(pending_invite.role, 'user');
  END IF;

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
    invited_role,
    pending_invite.position,
    pending_invite.position,
    COALESCE(pending_invite.fixed_salary, 0),
    COALESCE(pending_invite.commission_percent, 20),
    user_is_test
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = CASE
      WHEN EXCLUDED.position IN ('Diretor', 'Executivo de Negócios', 'SDR') THEN 'user'
      ELSE COALESCE(public.profiles.role, EXCLUDED.role)
    END,
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
