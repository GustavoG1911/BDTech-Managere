ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS mensalidade_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS implantacao_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_implantacao_paid_by_client BOOLEAN DEFAULT false;

