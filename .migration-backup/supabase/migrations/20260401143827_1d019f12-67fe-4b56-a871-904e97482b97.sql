
-- Create deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'BluePex',
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  implantation_value NUMERIC NOT NULL DEFAULT 0,
  closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_payment_date DATE,
  implantation_payment_date DATE,
  is_installment BOOLEAN NOT NULL DEFAULT false,
  installment_count INTEGER NOT NULL DEFAULT 0,
  installment_dates JSONB DEFAULT '[]'::jsonb,
  payment_status TEXT NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Temporary public policies (replace with auth-based policies later)
CREATE POLICY "Allow public read" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.deals FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.deals FOR DELETE USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
