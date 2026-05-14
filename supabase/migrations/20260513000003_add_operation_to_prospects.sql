ALTER TABLE public.prospects
ADD COLUMN IF NOT EXISTS operation text;

UPDATE public.prospects
SET operation = 'A definir'
WHERE operation IS NULL OR operation = '';

ALTER TABLE public.prospects
ALTER COLUMN operation SET DEFAULT 'A definir';

ALTER TABLE public.prospects
ALTER COLUMN operation SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prospects_operation_check'
      AND conrelid = 'public.prospects'::regclass
  ) THEN
    ALTER TABLE public.prospects
    ADD CONSTRAINT prospects_operation_check
    CHECK (operation IN ('BluePex', 'Opus Tech', 'A definir'));
  END IF;
END $$;
