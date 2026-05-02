DROP POLICY IF EXISTS "Edicao apenas para admin" ON public.global_parameters;

CREATE POLICY "Edicao apenas para admin"
ON public.global_parameters
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));