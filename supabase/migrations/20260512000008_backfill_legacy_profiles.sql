-- Recover users created before the current onboarding/approval flow existed.
-- They need a public profile row and a correct environment flag to appear
-- in the Admin/Diretor approval screen.

INSERT INTO public.profiles (
  user_id,
  display_name,
  full_name,
  role,
  position,
  job_title,
  fixed_salary,
  commission_percent,
  is_test_data,
  onboarding_completed_at
)
SELECT
  auth_user.id,
  COALESCE(NULLIF(auth_user.raw_user_meta_data ->> 'full_name', ''), auth_user.email),
  NULLIF(auth_user.raw_user_meta_data ->> 'full_name', ''),
  CASE
    WHEN auth_user.email ILIKE 'admin@%' THEN 'admin'
    ELSE 'user'
  END,
  NULL,
  CASE
    WHEN auth_user.email ILIKE 'admin@%' THEN 'Administrador do Sistema'
    ELSE NULL
  END,
  NULL,
  NULL,
  COALESCE(auth_user.email, '') ILIKE '%@teste.com',
  CASE
    WHEN auth_user.email ILIKE 'admin@%' THEN now()
    ELSE NULL
  END
FROM auth.users auth_user
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles profile
  WHERE profile.user_id = auth_user.id
);

UPDATE public.profiles profile
SET
  is_test_data = COALESCE(auth_user.email, '') ILIKE '%@teste.com',
  display_name = COALESCE(NULLIF(profile.display_name, ''), NULLIF(auth_user.raw_user_meta_data ->> 'full_name', ''), auth_user.email),
  full_name = COALESCE(NULLIF(profile.full_name, ''), NULLIF(auth_user.raw_user_meta_data ->> 'full_name', '')),
  role = CASE
    WHEN profile.role IS NULL AND auth_user.email ILIKE 'admin@%' THEN 'admin'
    WHEN profile.role IS NULL THEN 'user'
    ELSE profile.role
  END,
  job_title = CASE
    WHEN profile.role = 'admin'
      AND (profile.position IS NULL OR profile.position NOT IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR'))
      THEN COALESCE(NULLIF(profile.job_title, ''), 'Administrador do Sistema')
    ELSE profile.job_title
  END,
  onboarding_completed_at = CASE
    WHEN profile.role = 'admin'
      AND (profile.position IS NULL OR profile.position NOT IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR'))
      THEN COALESCE(profile.onboarding_completed_at, now())
    ELSE profile.onboarding_completed_at
  END
FROM auth.users auth_user
WHERE profile.user_id = auth_user.id
  AND (
    profile.is_test_data IS DISTINCT FROM (COALESCE(auth_user.email, '') ILIKE '%@teste.com')
    OR profile.display_name IS NULL
    OR profile.role IS NULL
    OR (
      profile.role = 'admin'
      AND (profile.position IS NULL OR profile.position NOT IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR'))
      AND profile.onboarding_completed_at IS NULL
    )
  );

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
  is_platform_admin boolean := COALESCE(NEW.email, '') ILIKE 'admin@%';
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
    is_test_data,
    onboarding_completed_at
  )
  VALUES (
    NEW.id,
    display,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    CASE WHEN is_platform_admin THEN 'admin' ELSE COALESCE(pending_invite.role, 'user') END,
    CASE WHEN is_platform_admin THEN NULL ELSE pending_invite.position END,
    CASE WHEN is_platform_admin THEN 'Administrador do Sistema' ELSE pending_invite.position END,
    CASE WHEN is_platform_admin THEN NULL ELSE pending_invite.fixed_salary END,
    CASE WHEN is_platform_admin THEN NULL ELSE pending_invite.commission_percent END,
    user_is_test,
    CASE WHEN is_platform_admin THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    position = COALESCE(public.profiles.position, EXCLUDED.position),
    job_title = COALESCE(public.profiles.job_title, EXCLUDED.job_title),
    fixed_salary = COALESCE(public.profiles.fixed_salary, EXCLUDED.fixed_salary),
    commission_percent = COALESCE(public.profiles.commission_percent, EXCLUDED.commission_percent),
    is_test_data = EXCLUDED.is_test_data,
    onboarding_completed_at = COALESCE(public.profiles.onboarding_completed_at, EXCLUDED.onboarding_completed_at);

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
