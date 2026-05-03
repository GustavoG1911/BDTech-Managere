-- Restringe SELECT de prospect_notes ao dono do prospect pai.
-- A policy original usava USING (true), expondo notas de todos os usuários.

DROP POLICY IF EXISTS "prospect_notes_select" ON public.prospect_notes;

CREATE POLICY "prospect_notes_select"
  ON public.prospect_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prospects p
      WHERE p.id = prospect_notes.prospect_id
        AND p.owner_id = auth.uid()
    )
  );
