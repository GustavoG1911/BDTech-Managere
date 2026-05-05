-- Add contact fields to prospects table
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS company_email  TEXT,
  ADD COLUMN IF NOT EXISTS company_phone  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email  TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone  TEXT;

-- Cross-role access: all authenticated users can read/write all prospects
DROP POLICY IF EXISTS "prospects_select" ON public.prospects;
CREATE POLICY "prospects_select"
  ON public.prospects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prospects_update" ON public.prospects;
CREATE POLICY "prospects_update"
  ON public.prospects FOR UPDATE TO authenticated USING (true);

-- Notes: any authenticated user can insert notes on any prospect
DROP POLICY IF EXISTS "prospect_notes_insert" ON public.prospect_notes;
CREATE POLICY "prospect_notes_insert"
  ON public.prospect_notes FOR INSERT TO authenticated WITH CHECK (true);

-- Notes: any authenticated user can read notes on any prospect
DROP POLICY IF EXISTS "prospect_notes_select" ON public.prospect_notes;
CREATE POLICY "prospect_notes_select"
  ON public.prospect_notes FOR SELECT TO authenticated USING (true);
