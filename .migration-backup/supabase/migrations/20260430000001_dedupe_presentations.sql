-- Garante um unico contador por mes/operacao/ambiente.
-- Corrige duplicatas antigas que faziam a UI somar ou alternar valores.

WITH ranked AS (
  SELECT
    id,
    date,
    operation,
    is_test_data,
    MAX(count) OVER (
      PARTITION BY date, operation, is_test_data
    ) AS canonical_count,
    ROW_NUMBER() OVER (
      PARTITION BY date, operation, is_test_data
      ORDER BY count DESC NULLS LAST, id::text DESC
    ) AS rn
  FROM public.presentations
),
canonical AS (
  UPDATE public.presentations p
  SET count = ranked.canonical_count
  FROM ranked
  WHERE p.id = ranked.id
    AND ranked.rn = 1
  RETURNING p.id
)
DELETE FROM public.presentations p
USING ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS presentations_month_operation_env_uidx
  ON public.presentations (date, operation, is_test_data);
