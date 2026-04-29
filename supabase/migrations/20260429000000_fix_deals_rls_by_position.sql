-- Corrige RLS operacional de deals para usar profiles.position em vez de role.
-- Tambem garante, de forma idempotente, as colunas que o frontend grava em deals.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS commission_percent integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS fixed_salary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_amount_snapshot numeric,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric,
  ADD COLUMN IF NOT EXISTS is_paid_to_user boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_user_confirmed_payment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mensalidade_paid_by_client boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_implantacao_paid_by_client boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mensalidade_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_implantacao_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_payment_date date,
  ADD COLUMN IF NOT EXISTS mensalidade_payment_date date,
  ADD COLUMN IF NOT EXISTS implantacao_payment_date date,
  ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

ALTER TABLE public.salary_payments
  ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_sdr_user_id ON public.deals(sdr_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_is_test_data ON public.deals(is_test_data);

CREATE OR REPLACE FUNCTION public.current_profile_position()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.position
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_profile_matches_env(_is_test_data boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_director_for_env(_is_test_data boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.position = 'Diretor'
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE OR REPLACE FUNCTION public.deal_user_is_executivo_for_env(_user_id uuid, _is_test_data boolean)
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
      AND p.position = 'Executivo de Negócios'
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can create own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete own deals" ON public.deals;
DROP POLICY IF EXISTS "Gestor can view all deals" ON public.deals;
DROP POLICY IF EXISTS "Gestor can update all deals" ON public.deals;
DROP POLICY IF EXISTS "deals_select_by_position" ON public.deals;
DROP POLICY IF EXISTS "deals_insert_by_position" ON public.deals;
DROP POLICY IF EXISTS "deals_update_by_position" ON public.deals;
DROP POLICY IF EXISTS "deals_delete_by_position" ON public.deals;

CREATE POLICY "deals_select_by_position"
  ON public.deals
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_director_for_env(is_test_data)
    OR (
      auth.uid() = user_id
      AND public.current_profile_matches_env(is_test_data)
    )
    OR (
      public.current_profile_position() = 'SDR'
      AND public.current_profile_matches_env(is_test_data)
      AND public.deal_user_is_executivo_for_env(user_id, is_test_data)
    )
  );

CREATE POLICY "deals_insert_by_position"
  ON public.deals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.current_user_is_director_for_env(is_test_data)
      AND public.deal_user_is_executivo_for_env(user_id, is_test_data)
    )
    OR (
      auth.uid() = user_id
      AND public.current_profile_position() = 'Executivo de Negócios'
      AND public.current_profile_matches_env(is_test_data)
    )
  );

CREATE POLICY "deals_update_by_position"
  ON public.deals
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_is_director_for_env(is_test_data)
    OR (
      auth.uid() = user_id
      AND public.current_profile_position() = 'Executivo de Negócios'
      AND public.current_profile_matches_env(is_test_data)
    )
  )
  WITH CHECK (
    public.current_user_is_director_for_env(is_test_data)
    OR (
      auth.uid() = user_id
      AND public.current_profile_position() = 'Executivo de Negócios'
      AND public.current_profile_matches_env(is_test_data)
    )
  );

CREATE POLICY "deals_delete_by_position"
  ON public.deals
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_is_director_for_env(is_test_data)
    OR (
      auth.uid() = user_id
      AND public.current_profile_position() = 'Executivo de Negócios'
      AND public.current_profile_matches_env(is_test_data)
    )
  );
