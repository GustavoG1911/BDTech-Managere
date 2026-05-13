import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri: string }[] };
  status: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
}

function classifyOperation(link: string, description: string): "BluePex" | "Opus Tech" | undefined {
  const content = `${link} ${description}`.toLowerCase();
  if (content.includes("meet.google.com") || content.includes("google meet")) return "BluePex";
  if (content.includes("teams.microsoft.com") || content.includes("microsoft teams")) return "Opus Tech";
  return undefined;
}

function getMeetingLink(event: GoogleEvent): string {
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find((e) => e.uri?.startsWith("https://"));
  return entry?.uri ?? "";
}

function calendarConfigId(isTestEnv: boolean) {
  return isTestEnv
    ? "00000000-0000-0000-0000-000000000002"
    : "00000000-0000-0000-0000-000000000001";
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? "Falha ao renovar token");
  return { accessToken: data.access_token as string, expiresIn: data.expires_in as number };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const isTestEnv = user.email?.endsWith("@teste.com") || false;

    // Load centralized admin Google tokens (single row, independent of calling user)
    const { data: adminConfig } = await (supabase as any)
      .from("admin_calendar_config")
      .select("google_refresh_token, google_access_token, google_token_expiry, sync_enabled, google_email, connected_by_user_id")
      .eq("id", calendarConfigId(isTestEnv))
      .eq("is_test_data", isTestEnv)
      .single();
    if (!adminConfig?.sync_enabled || !adminConfig.google_refresh_token) {
      return new Response(JSON.stringify({ error: "Conta Google centralizada não configurada. Peça ao administrador para conectar." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const centralOwnerUserId = adminConfig.connected_by_user_id;
    if (!centralOwnerUserId) {
      return new Response(JSON.stringify({ error: "Conta Google centralizada sem administrador responsavel. Reconecte a conta no painel admin." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Refresh access token if expired (with 60s buffer)
    let accessToken = adminConfig.google_access_token;
    const expiry = adminConfig.google_token_expiry ? new Date(adminConfig.google_token_expiry) : new Date(0);
    if (expiry.getTime() < Date.now() + 60_000) {
      const refreshed = await refreshAccessToken(clientId, clientSecret, adminConfig.google_refresh_token);
      accessToken = refreshed.accessToken;
      const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
      await (supabase as any).from("admin_calendar_config")
        .update({ google_access_token: accessToken, google_token_expiry: newExpiry })
        .eq("id", calendarConfigId(isTestEnv));
    }

    // Fetch Google Calendar events (primary calendar, next 60 days)
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&singleEvents=true&orderBy=startTime&maxResults=250`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!calRes.ok) throw new Error(`Google Calendar API error: ${calRes.status}`);
    const calData = await calRes.json();
    const googleEvents: GoogleEvent[] = calData.items ?? [];

    // Only import events where the user accepted (or is organizer)
    const accepted = googleEvents.filter((ev) => {
      if (ev.status === "cancelled") return false;
      const self = ev.attendees?.find((a) => a.self);
      if (!self) return true; // organizer, no self entry means they are the creator
      return self.responseStatus === "accepted";
    });

    let created = 0;
    let updated = 0;

    for (const ev of accepted) {
      const startRaw = ev.start.dateTime ?? ev.start.date ?? "";
      const endRaw = ev.end.dateTime ?? ev.end.date ?? "";
      if (!startRaw || !endRaw) continue;

      const meetingLink = getMeetingLink(ev);
      const operation = classifyOperation(meetingLink, ev.description ?? "");

      const payload = {
        user_id: centralOwnerUserId,
        google_event_id: ev.id,
        source: "google",
        title: ev.summary ?? "(Sem título)",
        start_time: new Date(startRaw).toISOString(),
        end_time: new Date(endRaw).toISOString(),
        description: ev.description ?? null,
        meeting_link: meetingLink || null,
        operation: operation ?? null,
        status: "Agendado",
        is_test_data: isTestEnv,
      };

      // Upsert based on google_event_id, avoids duplicates
      const { data: existing } = await (supabase as any)
        .from("calendar_events")
        .select("id")
        .eq("user_id", centralOwnerUserId)
        .eq("google_event_id", ev.id)
        .eq("is_test_data", isTestEnv)
        .maybeSingle();

      if (existing) {
        await (supabase as any).from("calendar_events").update(payload).eq("id", existing.id);
        updated++;
      } else {
        await (supabase as any).from("calendar_events").insert([payload]);
        created++;
      }
    }

    return new Response(JSON.stringify({ ok: true, created, updated, total: accepted.length, googleEmail: adminConfig.google_email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[google-calendar-sync]", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
