-- Adiciona coluna sdr_user_id na tabela deals
-- Vincula o SDR responsável pelo deal ao Executivo de Negócios que fechou.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_sdr_user_id ON public.deals(sdr_user_id);
