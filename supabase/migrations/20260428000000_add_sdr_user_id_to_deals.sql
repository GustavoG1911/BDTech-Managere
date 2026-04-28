ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_sdr_user_id ON public.deals(sdr_user_id);
