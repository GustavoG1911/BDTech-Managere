-- Closes remaining Lovable security findings after the production hardening pass.

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_is_platform_admin_for_env(_user_id uuid, _is_test_data boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.role = 'admin'
      AND (p.position IS NULL OR p.position NOT IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR'))
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
  )
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.position := NULL;
    NEW.fixed_salary := NULL;
    NEW.commission_percent := NULL;
    NEW.is_test_data := COALESCE(NEW.is_test_data, false);
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role
    OR OLD.position IS DISTINCT FROM NEW.position
    OR OLD.fixed_salary IS DISTINCT FROM NEW.fixed_salary
    OR OLD.commission_percent IS DISTINCT FROM NEW.commission_percent
    OR OLD.is_test_data IS DISTINCT FROM NEW.is_test_data
  THEN
    IF NOT public.profile_is_director_for_env(auth.uid(), COALESCE(OLD.is_test_data, NEW.is_test_data, false)) THEN
      RAISE EXCEPTION 'Apenas o Diretor pode alterar cargo, salario e comissao.';
    END IF;
  END IF;

  IF NEW.position IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR') THEN
    NEW.role := 'user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_insert_minimal" ON public.profiles;
CREATE POLICY "profiles_self_insert_minimal"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'user'
    AND position IS NULL
    AND fixed_salary IS NULL
    AND commission_percent IS NULL
  );

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS google_refresh_token,
  DROP COLUMN IF EXISTS google_access_token,
  DROP COLUMN IF EXISTS google_token_expiry,
  DROP COLUMN IF EXISTS google_email,
  DROP COLUMN IF EXISTS google_sync_enabled;

DROP POLICY IF EXISTS "commission_payments_recipient_confirm" ON public.commission_payments;
DROP POLICY IF EXISTS "commission_payments_recipient_confirm_own" ON public.commission_payments;
DROP POLICY IF EXISTS "commission_payments_recipient_confirm_or_reject_own" ON public.commission_payments;

CREATE POLICY "commission_payments_recipient_confirm_or_reject_own"
  ON public.commission_payments
  FOR UPDATE
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND paid_by_director_at IS NOT NULL
    AND confirmed_by_user_at IS NULL
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    AND paid_by_director_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.protect_commission_payment_user_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.profile_is_director_for_env(auth.uid(), COALESCE(OLD.is_test_data, NEW.is_test_data, false)) THEN
    RETURN NEW;
  END IF;

  IF OLD.deal_id IS DISTINCT FROM NEW.deal_id
    OR OLD.component IS DISTINCT FROM NEW.component
    OR OLD.competence_month IS DISTINCT FROM NEW.competence_month
    OR OLD.installment_index IS DISTINCT FROM NEW.installment_index
    OR OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.recipient_user_id IS DISTINCT FROM NEW.recipient_user_id
    OR OLD.paid_by_director_at IS DISTINCT FROM NEW.paid_by_director_at
    OR OLD.is_test_data IS DISTINCT FROM NEW.is_test_data
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Somente o Diretor pode alterar valores de comissao.';
  END IF;

  IF NEW.recipient_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Pagamento de comissao nao pertence ao usuario atual.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_commission_payment_user_updates_trg ON public.commission_payments;
CREATE TRIGGER protect_commission_payment_user_updates_trg
  BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_commission_payment_user_updates();

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_name text;
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'notifications'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_name);
    END LOOP;

    EXECUTE $policy$
      CREATE POLICY notifications_select_own
        ON public.notifications
        FOR SELECT
        TO authenticated
        USING (
          user_id = auth.uid()
          AND public.profile_matches_env(auth.uid(), is_test_data)
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY notifications_insert_same_env
        ON public.notifications
        FOR INSERT
        TO authenticated
        WITH CHECK (
          public.profile_matches_env(auth.uid(), is_test_data)
          AND public.profile_matches_env(user_id, is_test_data)
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY notifications_update_own
        ON public.notifications
        FOR UPDATE
        TO authenticated
        USING (
          user_id = auth.uid()
          AND public.profile_matches_env(auth.uid(), is_test_data)
        )
        WITH CHECK (
          user_id = auth.uid()
          AND public.profile_matches_env(auth.uid(), is_test_data)
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY notifications_delete_own
        ON public.notifications
        FOR DELETE
        TO authenticated
        USING (
          user_id = auth.uid()
          AND public.profile_matches_env(auth.uid(), is_test_data)
        )
    $policy$;
  END IF;
END $$;

DO $$
DECLARE
  policy_name text;
BEGIN
  IF to_regclass('public.presentations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY';

    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'presentations'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.presentations', policy_name);
    END LOOP;

    EXECUTE $policy$
      CREATE POLICY presentations_select_same_env
        ON public.presentations
        FOR SELECT
        TO authenticated
        USING (public.profile_matches_env(auth.uid(), is_test_data))
    $policy$;

    EXECUTE $policy$
      CREATE POLICY presentations_insert_same_env
        ON public.presentations
        FOR INSERT
        TO authenticated
        WITH CHECK (
          public.profile_matches_env(auth.uid(), is_test_data)
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY presentations_update_same_env
        ON public.presentations
        FOR UPDATE
        TO authenticated
        USING (public.profile_matches_env(auth.uid(), is_test_data))
        WITH CHECK (public.profile_matches_env(auth.uid(), is_test_data))
    $policy$;

    EXECUTE $policy$
      CREATE POLICY presentations_delete_same_env
        ON public.presentations
        FOR DELETE
        TO authenticated
        USING (public.profile_matches_env(auth.uid(), is_test_data))
    $policy$;
  END IF;
END $$;

DROP POLICY IF EXISTS "admin_calendar_config_read" ON public.admin_calendar_config;
REVOKE ALL ON TABLE public.admin_calendar_config FROM anon, authenticated;
DROP VIEW IF EXISTS public.admin_calendar_status;
CREATE VIEW public.admin_calendar_status AS
SELECT id, google_email, sync_enabled, updated_at
FROM public.admin_calendar_config;
GRANT SELECT ON public.admin_calendar_status TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "app_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "app_assets_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "app_assets_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "app_assets_admin_delete" ON storage.objects;

CREATE POLICY "avatars_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.jpg'
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.jpg'
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.jpg'
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.jpg'
  );

CREATE POLICY "app_assets_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'app-assets');

CREATE POLICY "app_assets_admin_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app-assets'
    AND name = 'system-logo'
    AND public.profile_is_platform_admin_for_env(auth.uid(), COALESCE((auth.jwt() ->> 'email') ILIKE '%@teste.com', false))
  );

CREATE POLICY "app_assets_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND name = 'system-logo'
    AND public.profile_is_platform_admin_for_env(auth.uid(), COALESCE((auth.jwt() ->> 'email') ILIKE '%@teste.com', false))
  )
  WITH CHECK (
    bucket_id = 'app-assets'
    AND name = 'system-logo'
    AND public.profile_is_platform_admin_for_env(auth.uid(), COALESCE((auth.jwt() ->> 'email') ILIKE '%@teste.com', false))
  );

CREATE POLICY "app_assets_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND name = 'system-logo'
    AND public.profile_is_platform_admin_for_env(auth.uid(), COALESCE((auth.jwt() ->> 'email') ILIKE '%@teste.com', false))
  );

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_gestor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_matches_env(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_has_position_for_env(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_is_operational_for_env(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_is_executivo_for_env(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_select_deal(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_deal(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_has_role_for_env(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_is_director_for_env(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_is_platform_admin_for_env(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.profile_matches_env(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_has_position_for_env(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_operational_for_env(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_executivo_for_env(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_select_deal(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_deal(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_has_role_for_env(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_director_for_env(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_platform_admin_for_env(uuid, boolean) TO authenticated;
