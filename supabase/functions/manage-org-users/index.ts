import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PASSWORD = "senha1010";
const ROLES = ["master", "operador", "colaborador", "leitor"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u, error: ue } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
  if (ue || !u?.user) return json({ error: "Unauthorized" }, 401);
  const caller = u.user;

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Somente Máster pode gerenciar usuários da organização.
  const { data: masterRow } = await admin
    .from("user_roles")
    .select("org_owner_id")
    .eq("user_id", caller.id)
    .eq("role", "master")
    .maybeSingle();
  if (!masterRow) return json({ error: "Apenas o perfil Máster pode gerenciar usuários." }, 403);
  const orgOwnerId = masterRow.org_owner_id as string;

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "list") {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, full_name, display_name, gender, phone_country_code, phone_area_code, phone_number, phone_is_whatsapp, must_change_password, allowed_modules, created_at")
        .eq("org_owner_id", orgOwnerId);
      const { data: roles } = await admin
        .from("user_roles")
        .select("user_id, role")
        .eq("org_owner_id", orgOwnerId);
      const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emails = new Map((authList?.users ?? []).map((x) => [x.id, x.email]));
      const users = (profs ?? []).map((p) => ({
        ...p,
        email: emails.get(p.user_id) ?? null,
        role: roles?.find((r) => r.user_id === p.user_id)?.role ?? "leitor",
        is_self: p.user_id === caller.id,
      }));
      return json({ ok: true, users, org_owner_id: orgOwnerId });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const role = String(body.role || "leitor");
      if (!email) return json({ error: "E-mail obrigatório." }, 400);
      if (!ROLES.includes(role)) return json({ error: "Perfil inválido." }, 400);

      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: body.full_name || email },
      });
      if (ce || !created?.user) return json({ error: ce?.message || "Falha ao criar usuário." }, 400);
      const newId = created.user.id;

      await admin.from("profiles").upsert(
        {
          user_id: newId,
          display_name: body.full_name || email,
          full_name: body.full_name ?? null,
          gender: body.gender ?? null,
          phone_country_code: body.phone_country_code ?? null,
          phone_area_code: body.phone_area_code ?? null,
          phone_number: body.phone_number ?? null,
          phone_is_whatsapp: !!body.phone_is_whatsapp,
          must_change_password: true,
          org_owner_id: orgOwnerId,
          allowed_modules: Array.isArray(body.allowed_modules) ? body.allowed_modules : [],
        },
        { onConflict: "user_id" },
      );

      await admin
        .from("user_roles")
        .upsert(
          { user_id: newId, org_owner_id: orgOwnerId, role },
          { onConflict: "user_id,org_owner_id,role" },
        );

      return json({ ok: true, user_id: newId, temp_password: DEFAULT_PASSWORD });
    }

    const targetId = String(body.user_id || "");
    if (!targetId) return json({ error: "Usuário não informado." }, 400);
    if (targetId === caller.id) return json({ error: "Você não pode alterar o próprio acesso aqui." }, 400);

    // Garante que o alvo pertence à mesma organização.
    const { data: target } = await admin
      .from("profiles")
      .select("user_id, org_owner_id")
      .eq("user_id", targetId)
      .maybeSingle();
    if (!target || target.org_owner_id !== orgOwnerId) {
      return json({ error: "Usuário não pertence à sua organização." }, 403);
    }

    if (action === "reset_password") {
      const { error } = await admin.auth.admin.updateUserById(targetId, { password: DEFAULT_PASSWORD });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ must_change_password: true }).eq("user_id", targetId);
      return json({ ok: true, temp_password: DEFAULT_PASSWORD });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
