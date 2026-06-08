import { supabase } from "@/integrations/supabase/client";

export type AdminCalendarStatus = {
  google_email: string | null;
  sync_enabled: boolean;
  updated_at: string | null;
};

export type GoogleCalendarSyncResult = {
  ok: boolean;
  created: number;
  updated: number;
  total: number;
  googleEmail?: string | null;
};

const getAccessToken = async () => {
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token;
};

const readResponseJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const getResponseField = (data: unknown, field: string) => {
  if (!data || typeof data !== "object") return undefined;
  return (data as Record<string, unknown>)[field];
};

const getResponseError = (data: unknown) => {
  const error = getResponseField(data, "error");
  return typeof error === "string" ? error : undefined;
};

const getResponseUrl = (data: unknown) => {
  const url = getResponseField(data, "url");
  return typeof url === "string" ? url : undefined;
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
  const data = await readResponseJson(res);
  const error = getResponseError(data);
  const url = getResponseUrl(data);
  if (!res.ok || error) throw new Error(error ?? "Erro ao iniciar conexão");
  if (!url) throw new Error("Resposta inválida ao iniciar conexão Google");
  window.location.href = url;
};

export const syncGoogleCalendar = async () => {
  const accessToken = await getAccessToken();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await readResponseJson(res);
  const error = getResponseError(data);
  if (!res.ok || error) throw new Error(error ?? "Erro na sincronização");
  return data as GoogleCalendarSyncResult;
};
