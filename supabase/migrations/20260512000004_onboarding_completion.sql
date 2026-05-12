-- Persist first-run onboarding completion without relaxing role/position security.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE public.profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
WHERE onboarding_completed_at IS NULL
  AND full_name IS NOT NULL
  AND btrim(full_name) <> ''
  AND (
    role = 'admin'
    OR position IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR')
  );

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

  IF NEW.position IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR') THEN
    NEW.role := 'user';
  END IF;

  RETURN NEW;
END;
$$;
