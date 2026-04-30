-- Granularidade de confirmacao de pagamentos.
-- Permite confirmar/recusar comissao por componente e evita salario duplicado por funcionario/mes.

ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS rejected_by_user_at timestamptz;

ALTER TABLE public.salary_payments
  ADD COLUMN IF NOT EXISTS confirmed_by_user_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by_user_at timestamptz;

WITH ranked_salary_payments AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY user_id, reference_month, is_test_data
      ORDER BY
        COALESCE(is_paid_by_gestor, false) DESC,
        payment_date DESC NULLS LAST,
        id::text DESC
    ) AS rn
  FROM public.salary_payments
)
DELETE FROM public.salary_payments sp
USING ranked_salary_payments ranked
WHERE sp.ctid = ranked.ctid
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS salary_payments_user_month_env_uidx
  ON public.salary_payments (user_id, reference_month, is_test_data);

DROP POLICY IF EXISTS "Recipient can confirm own commission payments" ON public.commission_payments;
DROP POLICY IF EXISTS "commission_payments_recipient_confirm_own" ON public.commission_payments;
DROP POLICY IF EXISTS "commission_payments_recipient_confirm_or_reject_own" ON public.commission_payments;

CREATE POLICY "commission_payments_recipient_confirm_or_reject_own"
  ON public.commission_payments
  FOR UPDATE
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND paid_by_director_at IS NOT NULL
    AND confirmed_by_user_at IS NULL
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    AND paid_by_director_at IS NOT NULL
  );

DROP POLICY IF EXISTS "salary_user_confirm_own" ON public.salary_payments;

CREATE POLICY "salary_user_confirm_own"
  ON public.salary_payments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND is_paid_by_gestor = true
    AND public.profile_matches_env(auth.uid(), is_test_data)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND is_paid_by_gestor = true
    AND public.profile_matches_env(auth.uid(), is_test_data)
  );
