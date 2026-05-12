-- Platform admins can approve/liberate users without becoming operational users.
-- Data visibility remains controlled by position; this only opens user approval.

CREATE OR REPLACE FUNCTION public.profile_can_manage_users_for_env(_user_id uuid, _is_test_data boolean)
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
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
      AND (
        p.position = 'Diretor'
        OR (
          p.role = 'admin'
          AND (p.position IS NULL OR p.position NOT IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR'))
        )
      )
  )
$$;

DROP POLICY IF EXISTS "profiles_director_update_same_env" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_or_director_update_same_env" ON public.profiles;
CREATE POLICY "profiles_admin_or_director_update_same_env"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
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
    IF NOT public.profile_can_manage_users_for_env(auth.uid(), COALESCE(OLD.is_test_data, NEW.is_test_data, false)) THEN
      RAISE EXCEPTION 'Apenas Admin ou Diretor pode alterar cargo, salario e comissao.';
    END IF;
  END IF;

  IF NEW.position = 'Diretor' OR NEW.position = 'SDR' OR NEW.position LIKE 'Executivo de Neg%' THEN
    NEW.role := 'user';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "salary_select_by_position" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_insert_by_director" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_update_by_director" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_delete_by_director" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_select_by_manager" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_insert_by_manager" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_update_by_manager" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_delete_by_manager" ON public.salary_payments;

CREATE POLICY "salary_select_by_manager"
  ON public.salary_payments
  FOR SELECT
  TO authenticated
  USING (
    (
      auth.uid() = user_id
      AND public.profile_matches_env(auth.uid(), is_test_data)
    )
    OR public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
  );

CREATE POLICY "salary_insert_by_manager"
  ON public.salary_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
    AND public.profile_matches_env(user_id, is_test_data)
  );

CREATE POLICY "salary_update_by_manager"
  ON public.salary_payments
  FOR UPDATE
  TO authenticated
  USING (public.profile_can_manage_users_for_env(auth.uid(), is_test_data))
  WITH CHECK (
    public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
    AND public.profile_matches_env(user_id, is_test_data)
  );

CREATE POLICY "salary_delete_by_manager"
  ON public.salary_payments
  FOR DELETE
  TO authenticated
  USING (public.profile_can_manage_users_for_env(auth.uid(), is_test_data));

REVOKE ALL ON FUNCTION public.profile_can_manage_users_for_env(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_can_manage_users_for_env(uuid, boolean) TO authenticated;
