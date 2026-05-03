import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    const { userId } = JSON.parse(atob(state)) as { userId: string };

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
    const profile = await profileRes.json();

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("profiles").update({
      google_refresh_token: tokens.refresh_token,
      google_access_token: tokens.access_token,
      google_token_expiry: expiry,
      google_email: profile.email,
      google_sync_enabled: true,
    }).eq("id", userId);

    return redirect("/agenda?google_connected=1");

  } catch (err) {
    console.error("[google-oauth-callback]", err);
    return redirect("/agenda?google_error=callback_failed");
  }
});
