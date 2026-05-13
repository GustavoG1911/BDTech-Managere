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

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
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

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, position, is_test_data")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const isOperationalPosition = OPERATIONAL_POSITIONS.includes(profile?.position ?? "");
    const isPureAdmin = profile?.role === "admin" && !isOperationalPosition;
    const isDirector = profile?.position === "Diretor";
    if (!isPureAdmin && !isDirector) {
      return new Response(JSON.stringify({ error: "Apenas Admin ou Diretor pode enviar convites." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, position, fixedSalary, commissionPercent, redirectTo } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "E-mail invalido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPERATIONAL_POSITIONS.includes(position)) {
      return new Response(JSON.stringify({ error: "Cargo invalido para convite." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const salary = Number(fixedSalary ?? 0);
    const commission = Math.round(Number(commissionPercent ?? 20));
    if (!Number.isFinite(salary) || salary < 0 || !Number.isFinite(commission) || commission < 0 || commission > 100) {
      return new Response(JSON.stringify({ error: "Salario ou comissao invalidos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isTestData = Boolean(profile?.is_test_data);
    const { data: existingInvite, error: existingError } = await adminClient
      .from("user_invitations")
      .select("id")
      .ilike("email", normalizedEmail)
      .eq("is_test_data", isTestData)
      .eq("status", "pending")
      .maybeSingle();

    if (existingError) {
      return new Response(JSON.stringify({ error: existingError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invitePayload = {
      email: normalizedEmail,
      position,
      role: "user",
      fixed_salary: salary,
      commission_percent: commission,
      invited_by: userData.user.id,
      is_test_data: isTestData,
      status: "pending",
      updated_at: new Date().toISOString(),
    };

    const saveResult = existingInvite?.id
      ? await adminClient.from("user_invitations").update(invitePayload).eq("id", existingInvite.id)
      : await adminClient.from("user_invitations").insert(invitePayload);

    if (saveResult.error) {
      return new Response(JSON.stringify({ error: saveResult.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
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
