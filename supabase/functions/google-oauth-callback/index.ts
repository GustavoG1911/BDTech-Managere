import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyState(state: string, secret: string) {
  const [payloadPart, signaturePart] = state.split(".");
  if (!payloadPart || !signaturePart) throw new Error("Estado OAuth inválido.");
  const payload = new TextDecoder().decode(base64UrlToBytes(payloadPart));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  if (base64Url(new Uint8Array(signature)) !== signaturePart) throw new Error("Assinatura OAuth inválida.");
  const parsed = JSON.parse(payload) as { userId: string; adminSetup?: boolean; ts?: number };
  if (!parsed.ts || Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error("Estado OAuth expirado.");
  return parsed;
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";

  const redirect = (path: string) =>
    new Response(null, { status: 302, headers: { Location: `${appUrl}${path}` } });

  if (!code || !state) return redirect("/agenda?google_error=missing_params");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const { userId } = await verifyState(state, Deno.env.get("GOOGLE_OAUTH_STATE_SECRET") ?? serviceRoleKey);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", userId).single();
    if (profile?.role !== "admin") throw new Error("Apenas admin pode conectar Google Calendar.");

    const callbackUrl = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description ?? "Falha ao trocar código por tokens.");

    // Get Google account email
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleProfile = await profileRes.json();

    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Save into the single centralized admin_calendar_config row (fixed UUID for upsert)
    await supabase.from("admin_calendar_config").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      google_refresh_token: tokens.refresh_token,
      google_access_token: tokens.access_token,
      google_token_expiry: expiry,
      google_email: googleProfile.email,
      sync_enabled: true,
      updated_at: new Date().toISOString(),
    });

    return redirect("/agenda?google_connected=1");

  } catch (err) {
    console.error("[google-oauth-callback]", err);
    return redirect("/agenda?google_error=callback_failed");
  }
});
