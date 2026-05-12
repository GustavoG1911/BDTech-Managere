-- Make the onboarding release safe for environments that were opened before
-- the newest profile column existed, and keep profile permissions strict.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone;

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

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.position := NULL;
    NEW.fixed_salary := NULL;
    NEW.commission_percent := NULL;
    NEW.is_test_data := COALESCE((auth.jwt() ->> 'email') ILIKE '%@teste.com', false);
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role
    OR OLD.position IS DISTINCT FROM NEW.position
    OR OLD.fixed_salary IS DISTINCT FROM NEW.fixed_salary
    OR OLD.commission_percent IS DISTINCT FROM NEW.commission_percent
    OR OLD.is_test_data IS DISTINCT FROM NEW.is_test_data
  THEN
    IF NOT public.profile_is_director_for_env(auth.uid(), COALESCE(OLD.is_test_data, NEW.is_test_data, false)) THEN
      RAISE EXCEPTION 'Apenas o Diretor pode alterar cargo, salario e comissao.';
    END IF;
  END IF;

  IF NEW.position = 'Diretor' OR NEW.position = 'SDR' OR NEW.position LIKE 'Executivo de Neg%' THEN
    NEW.role := 'user';
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
WHERE onboarding_completed_at IS NULL
  AND full_name IS NOT NULL
  AND btrim(full_name) <> ''
  AND (
    role = 'admin'
    OR position = 'Diretor'
    OR position = 'SDR'
    OR position LIKE 'Executivo de Neg%'
  );

UPDATE public.profiles profile
SET is_test_data = true
FROM auth.users auth_user
WHERE profile.user_id = auth_user.id
  AND COALESCE(profile.is_test_data, false) = false
  AND COALESCE(auth_user.email, '') ILIKE '%@teste.com';
