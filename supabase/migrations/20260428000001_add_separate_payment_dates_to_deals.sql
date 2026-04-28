-- Prepara estrutura para pagamentos de comissão por componente.
-- Fase 1: cria tabela commission_payments para rastrear baixa/confirmação
-- de mensalidade e implantação independentemente, com competência financeira
-- já calculada pela Regra do Dia 07.
--
-- ATENÇÃO: os campos is_paid_to_user e is_user_confirmed_payment em deals
-- continuam existindo como legado durante a migração gradual.
-- Após migrar todas as telas para commission_payments, eles podem ser removidos.

CREATE TABLE IF NOT EXISTS public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  component text NOT NULL CHECK (component IN ('mensalidade', 'implantacao')),
  competence_month text NOT NULL, -- YYYY-MM já com Regra do Dia 07
  amount numeric NOT NULL,
  paid_by_director_at timestamptz,
  confirmed_by_user_at timestamptz,
  is_test_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_deal_id
  ON public.commission_payments(deal_id);

CREATE INDEX IF NOT EXISTS idx_commission_payments_competence_month
  ON public.commission_payments(competence_month);

CREATE INDEX IF NOT EXISTS idx_commission_payments_is_test_data
  ON public.commission_payments(is_test_data);

-- RLS: habilitar após configurar políticas
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
