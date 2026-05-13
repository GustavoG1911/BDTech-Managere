-- Align user invitations with the current Admin/Diretor management model.
-- Visibility of business data still comes from position; this only controls
-- who can manage users, invitations and compensation settings.

CREATE OR REPLACE FUNCTION public.profile_can_manage_users_for_env(_user_id uuid, _is_test_data boolean)
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
      AND COALESCE(p.is_test_data, false) = COALESCE(_is_test_data, false)
      AND (
        p.position = 'Diretor'
        OR (
          p.role = 'admin'
          AND (
            p.position IS NULL
            OR p.position NOT IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR')
          )
        )
      )
  )
$$;

DROP POLICY IF EXISTS "user_invitations_admin_select" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_admin_insert" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_admin_update" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_admin_delete" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_manager_select" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_manager_insert" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_manager_update" ON public.user_invitations;
DROP POLICY IF EXISTS "user_invitations_manager_delete" ON public.user_invitations;

CREATE POLICY "user_invitations_manager_select"
  ON public.user_invitations
  FOR SELECT
  TO authenticated
  USING (public.profile_can_manage_users_for_env(auth.uid(), is_test_data));

CREATE POLICY "user_invitations_manager_insert"
  ON public.user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'user'
    AND position IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR')
    AND public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
  );

CREATE POLICY "user_invitations_manager_update"
  ON public.user_invitations
  FOR UPDATE
  TO authenticated
  USING (public.profile_can_manage_users_for_env(auth.uid(), is_test_data))
  WITH CHECK (
    role = 'user'
    AND (
      position IS NULL
      OR position IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR')
    )
    AND public.profile_can_manage_users_for_env(auth.uid(), is_test_data)
  );

CREATE POLICY "user_invitations_manager_delete"
  ON public.user_invitations
  FOR DELETE
  TO authenticated
  USING (public.profile_can_manage_users_for_env(auth.uid(), is_test_data));

UPDATE public.user_invitations
SET role = 'user',
    updated_at = now()
WHERE role <> 'user'
  AND (
    position IS NULL
    OR position IN ('Diretor', 'Executivo de Negocios', 'Executivo de Negócios', 'SDR')
  );

CREATE OR REPLACE FUNCTION public.notify_profile_compensation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_parts text[] := ARRAY[]::text[];
  message_text text;
BEGIN
  IF OLD.fixed_salary IS DISTINCT FROM NEW.fixed_salary THEN
    changed_parts := array_append(changed_parts, 'salario');
  END IF;

  IF OLD.commission_percent IS DISTINCT FROM NEW.commission_percent THEN
    changed_parts := array_append(changed_parts, 'comissao');
  END IF;

  IF array_length(changed_parts, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  message_text := 'Seu ' || array_to_string(changed_parts, ' e ') || ' foi atualizado na Gestao de Equipe.';

  INSERT INTO public.notifications (user_id, title, message, is_test_data, is_read)
  VALUES (
    NEW.user_id,
    'Remuneracao atualizada',
    message_text,
    COALESCE(NEW.is_test_data, false),
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_profile_compensation_change_trg ON public.profiles;
CREATE TRIGGER notify_profile_compensation_change_trg
  AFTER UPDATE OF fixed_salary, commission_percent ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.fixed_salary IS DISTINCT FROM NEW.fixed_salary
    OR OLD.commission_percent IS DISTINCT FROM NEW.commission_percent
  )
  EXECUTE FUNCTION public.notify_profile_compensation_change();

REVOKE ALL ON FUNCTION public.profile_can_manage_users_for_env(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_profile_compensation_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_can_manage_users_for_env(uuid, boolean) TO authenticated;
