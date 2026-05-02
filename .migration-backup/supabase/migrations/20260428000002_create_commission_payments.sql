CREATE TABLE IF NOT EXISTS public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  component text NOT NULL CHECK (component IN ('mensalidade', 'implantacao')),
  competence_month text NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_payments_unique_component_month
  ON public.commission_payments(deal_id, component, competence_month);

