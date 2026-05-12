import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Required env vars (set in Supabase Dashboard → Settings → Edge Functions):
//   GOOGLE_CLIENT_ID       — OAuth2 client ID from Google Cloud Console
//   GOOGLE_CLIENT_SECRET   — OAuth2 client secret
//   SUPABASE_URL           — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
//   APP_URL                — frontend URL, e.g. https://yourdomain.com

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signState(payload: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${base64Url(enc.encode(payload))}.${base64Url(new Uint8Array(signature))}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID não configurado.");

    // Verify caller is authenticated
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Only the platform admin (role = "admin") may connect the centralized Google account
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas o administrador da plataforma pode conectar a conta Google centralizada." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Callback URL points to the google-oauth-callback Edge Function
    const callbackUrl = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    // State encodes adminSetup flag so callback knows to save to admin_calendar_config
    const payload = JSON.stringify({ userId: user.id, adminSetup: true, ts: Date.now() });
    const state = await signState(payload, Deno.env.get("GOOGLE_OAUTH_STATE_SECRET") ?? serviceRoleKey);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return new Response(JSON.stringify({ url: authUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
