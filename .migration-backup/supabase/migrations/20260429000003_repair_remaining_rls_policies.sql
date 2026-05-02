-- Reparo complementar de RLS operacional.
-- Mantem a regra por profiles.position e por ambiente is_test_data.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

ALTER TABLE public.salary_payments
  ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.profile_matches_env(_user_id uuid, _is_test_data boolean)
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
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_has_position_for_env(
  _user_id uuid,
  _position text,
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
      AND p.position = _position
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_is_operational_for_env(_user_id uuid, _is_test_data boolean)
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
      AND (
        p.position IN ('Diretor', 'SDR')
        OR p.position ILIKE 'Executivo de Neg%'
      )
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_is_executivo_for_env(_user_id uuid, _is_test_data boolean)
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
      AND p.position ILIKE 'Executivo de Neg%'
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_select_deal(_deal_user_id uuid, _is_test_data boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.profile_has_position_for_env(auth.uid(), 'Diretor', _is_test_data)
    OR (
      auth.uid() = _deal_user_id
      AND public.profile_is_executivo_for_env(auth.uid(), _is_test_data)
    )
    OR (
      public.profile_has_position_for_env(auth.uid(), 'SDR', _is_test_data)
      AND public.profile_is_executivo_for_env(_deal_user_id, _is_test_data)
    )
$$;

CREATE OR REPLACE FUNCTION public.can_write_deal(_deal_user_id uuid, _is_test_data boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      public.profile_has_position_for_env(auth.uid(), 'Diretor', _is_test_data)
      AND public.profile_is_executivo_for_env(_deal_user_id, _is_test_data)
    )
    OR (
      auth.uid() = _deal_user_id
      AND public.profile_is_executivo_for_env(auth.uid(), _is_test_data)
    )
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_operational_select_same_env" ON public.profiles;
CREATE POLICY "profiles_operational_select_same_env"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.profile_is_operational_for_env(auth.uid(), is_test_data)
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "deals_select_by_position" ON public.deals;
DROP POLICY IF EXISTS "deals_update_by_position" ON public.deals;
DROP POLICY IF EXISTS "deals_delete_by_position" ON public.deals;
DROP POLICY IF EXISTS "deals_select_remaining_repair" ON public.deals;
DROP POLICY IF EXISTS "deals_update_remaining_repair" ON public.deals;
DROP POLICY IF EXISTS "deals_delete_remaining_repair" ON public.deals;

CREATE POLICY "deals_select_remaining_repair"
  ON public.deals
  FOR SELECT
  TO authenticated
  USING (public.can_select_deal(user_id, is_test_data));

CREATE POLICY "deals_update_remaining_repair"
  ON public.deals
  FOR UPDATE
  TO authenticated
  USING (public.can_write_deal(user_id, is_test_data))
  WITH CHECK (public.can_write_deal(user_id, is_test_data));

CREATE POLICY "deals_delete_remaining_repair"
  ON public.deals
  FOR DELETE
  TO authenticated
  USING (public.can_write_deal(user_id, is_test_data));

DROP POLICY IF EXISTS "Users can view own salary payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Gestor can manage salary payments" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_select_by_position" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_insert_by_director" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_update_by_director" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_delete_by_director" ON public.salary_payments;

CREATE POLICY "salary_select_by_position"
  ON public.salary_payments
  FOR SELECT
  TO authenticated
  USING (
    (
      auth.uid() = user_id
      AND public.profile_matches_env(auth.uid(), is_test_data)
    )
    OR public.profile_has_position_for_env(auth.uid(), 'Diretor', is_test_data)
  );

CREATE POLICY "salary_insert_by_director"
  ON public.salary_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_has_position_for_env(auth.uid(), 'Diretor', is_test_data)
    AND public.profile_matches_env(user_id, is_test_data)
  );

CREATE POLICY "salary_update_by_director"
  ON public.salary_payments
  FOR UPDATE
  TO authenticated
  USING (public.profile_has_position_for_env(auth.uid(), 'Diretor', is_test_data))
  WITH CHECK (
    public.profile_has_position_for_env(auth.uid(), 'Diretor', is_test_data)
    AND public.profile_matches_env(user_id, is_test_data)
  );

CREATE POLICY "salary_delete_by_director"
  ON public.salary_payments
  FOR DELETE
  TO authenticated
  USING (public.profile_has_position_for_env(auth.uid(), 'Diretor', is_test_data));
