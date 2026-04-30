-- Reparo minimo para destravar INSERT em deals.
-- Rode este arquivo inteiro no SQL Editor.

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own deals" ON public.deals;
DROP POLICY IF EXISTS "deals_insert_by_position" ON public.deals;
DROP POLICY IF EXISTS "deals_director_insert_for_executivo_same_env" ON public.deals;
DROP POLICY IF EXISTS "deals_executivo_insert_own_same_env" ON public.deals;
DROP POLICY IF EXISTS "deals_insert_repaired" ON public.deals;
DROP POLICY IF EXISTS "deals_insert_director_or_owner" ON public.deals;

CREATE POLICY "deals_insert_director_or_owner"
ON public.deals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles actor
    WHERE actor.user_id = auth.uid()
      AND COALESCE(actor.is_test_data, false) = COALESCE(deals.is_test_data, false)
      AND (
        (
          actor.position = 'Diretor'
          AND EXISTS (
            SELECT 1
            FROM public.profiles owner_profile
            WHERE owner_profile.user_id = deals.user_id
              AND owner_profile.position = 'Executivo de Negócios'
              AND COALESCE(owner_profile.is_test_data, false) = COALESCE(deals.is_test_data, false)
          )
        )
        OR (
          actor.position = 'Executivo de Negócios'
          AND auth.uid() = deals.user_id
        )
      )
  )
);
