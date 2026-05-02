ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_amount_snapshot NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_rate_snapshot NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_user_confirmed_payment BOOLEAN DEFAULT false;
