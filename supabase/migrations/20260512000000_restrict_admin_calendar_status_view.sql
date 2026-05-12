-- Restrict the token-free calendar status view to the only access the app needs.
REVOKE ALL ON TABLE public.admin_calendar_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_calendar_status TO authenticated;
