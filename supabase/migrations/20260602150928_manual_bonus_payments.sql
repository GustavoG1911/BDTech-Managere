CREATE TABLE IF NOT EXISTS public.manual_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_type text NOT NULL DEFAULT 'Bônus',
  description text NOT NULL,
  reference_month date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  is_paid_by_gestor boolean NOT NULL DEFAULT true,
  payment_date timestamptz,
  confirmed_by_user_at timestamptz,
  rejected_by_user_at timestamptz,
  is_test_data boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_payments_user_month_idx
  ON public.manual_payments (user_id, reference_month, is_test_data);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_payments_select_by_manager" ON public.manual_payments;
DROP POLICY IF EXISTS "manual_payments_insert_by_manager" ON public.manual_payments;
DROP POLICY IF EXISTS "manual_payments_update_by_manager" ON public.manual_payments;
DROP POLICY IF EXISTS "manual_payments_delete_by_manager" ON public.manual_payments;
DROP POLICY IF EXISTS "manual_payments_user_confirm_own" ON public.manual_payments;

CREATE POLICY "manual_payments_select_by_manager"
  ON public.manual_payments
  FOR SELECT
  TO authenticated
  USING (
    (
      auth.uid() = user_id
      AND public.profile_matches_env(auth.uid(), is_test_data)
    )
    OR public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
  );

CREATE POLICY "manual_payments_insert_by_manager"
  ON public.manual_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
    AND public.profile_matches_env(user_id, is_test_data)
  );

CREATE POLICY "manual_payments_update_by_manager"
  ON public.manual_payments
  FOR UPDATE
  TO authenticated
  USING (public.profile_can_manage_users_for_env(auth.uid(), is_test_data))
  WITH CHECK (
    public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
    AND public.profile_matches_env(user_id, is_test_data)
  );

CREATE POLICY "manual_payments_delete_by_manager"
  ON public.manual_payments
  FOR DELETE
  TO authenticated
  USING (public.profile_can_manage_users_for_env(auth.uid(), is_test_data));

CREATE POLICY "manual_payments_user_confirm_own"
  ON public.manual_payments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND is_paid_by_gestor = true
    AND confirmed_by_user_at IS NULL
    AND public.profile_matches_env(auth.uid(), is_test_data)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND is_paid_by_gestor = true
    AND public.profile_matches_env(auth.uid(), is_test_data)
  );
