
-- Create is_gestor security definer function
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'gestor'
  )
$$;

-- Gestor can view all deals
CREATE POLICY "Gestor can view all deals"
ON public.deals
FOR SELECT
TO authenticated
USING (public.is_gestor(auth.uid()));

-- Gestor can update all deals (for confirming receipts)
CREATE POLICY "Gestor can update all deals"
ON public.deals
FOR UPDATE
TO authenticated
USING (public.is_gestor(auth.uid()));

-- Enable RLS on salary_payments if not already
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- Gestor can view all salary_payments
CREATE POLICY "Gestor can view all salary_payments"
ON public.salary_payments
FOR SELECT
TO authenticated
USING (public.is_gestor(auth.uid()));

-- Gestor can update salary_payments (mark as paid)
CREATE POLICY "Gestor can update salary_payments"
ON public.salary_payments
FOR UPDATE
TO authenticated
USING (public.is_gestor(auth.uid()));

-- Gestor can insert salary_payments
CREATE POLICY "Gestor can insert salary_payments"
ON public.salary_payments
FOR INSERT
TO authenticated
WITH CHECK (public.is_gestor(auth.uid()));

-- Users can view their own salary_payments
CREATE POLICY "Users can view own salary_payments"
ON public.salary_payments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
