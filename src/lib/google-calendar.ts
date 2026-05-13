import { supabase } from "@/integrations/supabase/client";

export type AdminCalendarStatus = {
  google_email: string | null;
  sync_enabled: boolean;
  updated_at: string | null;
};

const getAccessToken = async () => {
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token;
};

export const fetchAdminCalendarStatus = async (): Promise<AdminCalendarStatus | null> => {
  const { data, error } = await (supabase as any)
    .from("admin_calendar_status")
    .select("sync_enabled, google_email, updated_at")
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const startGoogleCalendarConnection = async (returnTo: string) => {
  const accessToken = await getAccessToken();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-initiate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ returnTo }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? "Erro ao iniciar conexão");
  window.location.href = data.url;
};

export const syncGoogleCalendar = async () => {
  const accessToken = await getAccessToken();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? "Erro na sincronização");
  return data as { ok: boolean; created: number; updated: number; total: number; googleEmail?: string | null };
};
