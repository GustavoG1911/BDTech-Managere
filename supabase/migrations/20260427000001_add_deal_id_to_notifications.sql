ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_deal_id ON public.notifications(deal_id);
