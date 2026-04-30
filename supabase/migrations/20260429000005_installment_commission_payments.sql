-- Comissao de implantacao parcelada por parcela.

ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS installment_index integer,
  ADD COLUMN IF NOT EXISTS installment_index_key integer
    GENERATED ALWAYS AS (COALESCE(installment_index, -1)) STORED;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.commission_payments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%component%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.commission_payments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.commission_payments
  ADD CONSTRAINT commission_payments_component_check
  CHECK (component IN ('mensalidade', 'implantacao', 'implantacao_parcela'));

DROP INDEX IF EXISTS idx_commission_payments_unique_component_month;
DROP INDEX IF EXISTS idx_commission_payments_unique_recipient_component_month;
DROP INDEX IF EXISTS idx_commission_payments_unique_recipient_component_month_installment;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY deal_id, component, competence_month, recipient_user_id, COALESCE(installment_index, -1)
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    ) AS rn
  FROM public.commission_payments
)
DELETE FROM public.commission_payments cp
USING ranked r
WHERE cp.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_payments_unique_recipient_component_month_installment
  ON public.commission_payments(deal_id, component, competence_month, recipient_user_id, installment_index_key);
