-- 1. Adiciona coluna recipient_user_id para rastrear quem recebe a comissão
--    (permite registros separados para Executivo e SDR no mesmo deal/componente/mês)
ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commission_payments_recipient_user_id
  ON public.commission_payments(recipient_user_id);

-- 2. Substitui índice único — inclui recipient_user_id para permitir
--    um registro por (deal, componente, mês, beneficiário)
DROP INDEX IF EXISTS idx_commission_payments_unique_component_month;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_payments_unique_recipient_component_month
  ON public.commission_payments(deal_id, component, competence_month, recipient_user_id);

-- 3. Garante RLS habilitado (idempotente)
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- 4. Policies usando position, não role (guardrail do projeto)
DROP POLICY IF EXISTS "commission_payments_diretor_all"      ON public.commission_payments;
DROP POLICY IF EXISTS "commission_payments_recipient_select" ON public.commission_payments;
DROP POLICY IF EXISTS "commission_payments_recipient_confirm" ON public.commission_payments;

-- Diretor: acesso completo dentro do próprio ambiente (test/prod isolados)
CREATE POLICY "commission_payments_diretor_all"
  ON public.commission_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.position = 'Diretor'
        AND profiles.is_test_data = commission_payments.is_test_data
    )
  );

-- Executivo/SDR: leitura dos próprios pagamentos
CREATE POLICY "commission_payments_recipient_select"
  ON public.commission_payments
  FOR SELECT
  USING (recipient_user_id = auth.uid());

-- Executivo/SDR: confirmação dos próprios pagamentos (só após baixa do diretor)
CREATE POLICY "commission_payments_recipient_confirm"
  ON public.commission_payments
  FOR UPDATE
  USING (
    recipient_user_id = auth.uid()
    AND paid_by_director_at IS NOT NULL
  );
