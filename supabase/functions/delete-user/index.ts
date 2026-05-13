import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPERATIONAL_POSITIONS = ["Diretor", "Executivo de Negócios", "SDR"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.");
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Sessao nao informada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessao invalida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return new Response(JSON.stringify({ error: "Usuario invalido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === userData.user.id) {
      return new Response(JSON.stringify({ error: "Voce nao pode excluir seu proprio usuario." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: actorProfile, error: actorError } = await adminClient
      .from("profiles")
      .select("role, position, is_test_data")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (actorError || !actorProfile) {
      return new Response(JSON.stringify({ error: "Perfil do solicitante nao encontrado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorIsOperational = OPERATIONAL_POSITIONS.includes(actorProfile.position ?? "");
    const actorIsPureAdmin = actorProfile.role === "admin" && !actorIsOperational;
    const actorIsDirector = actorProfile.position === "Diretor";
    if (!actorIsPureAdmin && !actorIsDirector) {
      return new Response(JSON.stringify({ error: "Apenas Admin ou Diretor pode excluir usuarios." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("role, position, is_test_data")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return new Response(JSON.stringify({ error: "Usuario nao encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Boolean(targetProfile.is_test_data) !== Boolean(actorProfile.is_test_data)) {
      return new Response(JSON.stringify({ error: "Usuario pertence a outro ambiente." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetIsOperational = OPERATIONAL_POSITIONS.includes(targetProfile.position ?? "");
    const targetIsPureAdmin = targetProfile.role === "admin" && !targetIsOperational;
    if (targetIsPureAdmin && !actorIsPureAdmin) {
      return new Response(JSON.stringify({ error: "Apenas Admin pode excluir outro Admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetIsPureAdmin) {
      const { data: adminProfiles } = await adminClient
        .from("profiles")
        .select("position")
        .eq("role", "admin")
        .eq("is_test_data", Boolean(targetProfile.is_test_data));

      const pureAdminCount = (adminProfiles ?? []).filter((profile) =>
        !OPERATIONAL_POSITIONS.includes(profile.position ?? "")
      ).length;

      if (pureAdminCount <= 1) {
        return new Response(JSON.stringify({ error: "Nao e possivel excluir o ultimo Admin do ambiente." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await adminClient.from("salary_payments").delete().eq("user_id", userId);
    await adminClient.from("calendar_events").delete().eq("user_id", userId);
    await adminClient.from("prospects").delete().eq("owner_id", userId);
    await adminClient.from("notifications").delete().eq("user_id", userId);
    await adminClient.from("commission_payments").update({ recipient_user_id: null }).eq("recipient_user_id", userId);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
