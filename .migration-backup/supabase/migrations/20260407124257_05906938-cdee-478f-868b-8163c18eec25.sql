-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Drop the recursive policy we just created
DROP POLICY IF EXISTS "Admin pode ver todos os perfis" ON public.profiles;

-- Recreate with security definer function
CREATE POLICY "Admin pode ver todos os perfis"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix the existing admin update policy that also has recursion risk
DROP POLICY IF EXISTS "Admin pode atualizar qualquer perfil" ON public.profiles;

CREATE POLICY "Admin pode atualizar qualquer perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));