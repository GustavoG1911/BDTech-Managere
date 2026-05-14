CREATE TABLE IF NOT EXISTS public.payment_due_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_due_day integer NOT NULL DEFAULT 1 CHECK (salary_due_day BETWEEN 1 AND 31),
  commission_due_day integer NOT NULL DEFAULT 20 CHECK (commission_due_day BETWEEN 1 AND 31),
  is_test_data boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_due_settings_env_uidx
  ON public.payment_due_settings (is_test_data);

INSERT INTO public.payment_due_settings (id, salary_due_day, commission_due_day, is_test_data)
VALUES
  ('00000000-0000-0000-0000-000000000010', 1, 20, false),
  ('00000000-0000-0000-0000-000000000011', 1, 20, true)
ON CONFLICT (is_test_data) DO UPDATE
SET
  salary_due_day = COALESCE(public.payment_due_settings.salary_due_day, EXCLUDED.salary_due_day),
  commission_due_day = COALESCE(public.payment_due_settings.commission_due_day, EXCLUDED.commission_due_day);

ALTER TABLE public.payment_due_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_due_settings_select_same_env" ON public.payment_due_settings;
CREATE POLICY "payment_due_settings_select_same_env"
  ON public.payment_due_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(payment_due_settings.is_test_data, false)
    )
  );

DROP POLICY IF EXISTS "payment_due_settings_upsert_by_manager" ON public.payment_due_settings;
CREATE POLICY "payment_due_settings_upsert_by_manager"
  ON public.payment_due_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(payment_due_settings.is_test_data, false)
        AND (p.role = 'admin' OR p.position = 'Diretor')
    )
  );

DROP POLICY IF EXISTS "payment_due_settings_update_by_manager" ON public.payment_due_settings;
CREATE POLICY "payment_due_settings_update_by_manager"
  ON public.payment_due_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(payment_due_settings.is_test_data, false)
        AND (p.role = 'admin' OR p.position = 'Diretor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.is_test_data, false) = COALESCE(payment_due_settings.is_test_data, false)
        AND (p.role = 'admin' OR p.position = 'Diretor')
    )
  );
