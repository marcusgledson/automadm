import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PASSWORD = "senha1010";
const ROLES = ["master", "operador", "colaborador", "leitor"];
const RANK: Record<string, number> = { master: 4, operador: 3, colaborador: 2, leitor: 1 };
const LOGGABLE = ["update_role", "update_modules", "update_profile"];
/** Validade da senha padrão entregue no primeiro acesso (72 horas). */
const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;
/** Espera mínima entre dois reenvios de e-mail de acesso. */
const RESEND_COOLDOWN_MS = 60 * 1000;
const expiryFromNow = () => new Date(Date.now() + TEMP_PASSWORD_TTL_MS).toISOString();

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

  const rankOf = async (userId: string) => {
    const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
    return (data ?? []).reduce((max, r) => Math.max(max, RANK[r.role as string] ?? 0), 0);
  };

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const action = String(body.action || "");

  // Ação disponível a qualquer usuário autenticado: registrar a própria troca de senha.
  if (action === "self_password_changed") {
    const { data: prof } = await admin
      .from("profiles")
      .select("org_owner_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    await admin.from("audit_logs").insert({
      org_owner_id: prof?.org_owner_id ?? caller.id,
      actor_id: caller.id,
      actor_email: caller.email,
      action: "change_password",
      target_user_id: caller.id,
      target_email: caller.email,
      details: {},
    });
    await admin
      .from("profiles")
      .update({ temp_password_expires_at: null, password_email_sent_at: null })
      .eq("user_id", caller.id);
    return json({ ok: true });
  }

  /** Registra na auditoria um evento do próprio usuário (sem exigir perfil Máster). */
  const selfLog = async (kind: string, details: Record<string, unknown> = {}) => {
    const { data: prof } = await admin
      .from("profiles")
      .select("org_owner_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    await admin.from("audit_logs").insert({
      org_owner_id: prof?.org_owner_id ?? caller.id,
      actor_id: caller.id,
      actor_email: caller.email,
      action: kind,
      target_user_id: caller.id,
      target_email: caller.email,
      details,
    });
  };

  // Reenvio do acesso por e-mail (sempre para o e-mail cadastrado na conta).
  if (action === "resend_access_email") {
    const email = caller.email;
    if (!email) return json({ error: "Sua conta não possui e-mail cadastrado." }, 400);

    const { data: prof } = await admin
      .from("profiles")
      .select("password_email_sent_at")
      .eq("user_id", caller.id)
      .maybeSingle();
    const last = prof?.password_email_sent_at ? new Date(prof.password_email_sent_at).getTime() : 0;
    const elapsed = Date.now() - last;
    if (last && elapsed < RESEND_COOLDOWN_MS) {
      return json(
        {
          error: `Aguarde ${Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)} segundo(s) para reenviar.`,
          retry_in: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
        },
        429,
      );
    }

    const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : undefined;
    const { error } = await anon.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) return json({ error: error.message }, 400);

    const expires = expiryFromNow();
    await admin
      .from("profiles")
      .update({ password_email_sent_at: new Date().toISOString(), temp_password_expires_at: expires })
      .eq("user_id", caller.id);
    await selfLog("resend_access_email", { email });
    return json({ ok: true, expires_at: expires, cooldown: RESEND_COOLDOWN_MS / 1000 });
  }

  // Registra que o prazo da senha padrão expirou (uma vez por sessão do front).
  if (action === "access_link_expired") {
    await selfLog("temp_password_expired", {});
    return json({ ok: true });
  }

  // Somente Máster pode gerenciar usuários da organização.
  const { data: masterRow } = await admin
    .from("user_roles")
    .select("org_owner_id")
    .eq("user_id", caller.id)
    .eq("role", "master")
    .maybeSingle();
  if (!masterRow) return json({ error: "Apenas o perfil Máster pode gerenciar usuários." }, 403);
  const orgOwnerId = masterRow.org_owner_id as string;
  const isOrgOwner = orgOwnerId === caller.id;
  const callerRank = await rankOf(caller.id);

  const log = async (
    logAction: string,
    targetId: string | null,
    targetEmail: string | null,
    details: Record<string, unknown> = {},
  ) => {
    await admin.from("audit_logs").insert({
      org_owner_id: orgOwnerId,
      actor_id: caller.id,
      actor_email: caller.email,
      action: logAction,
      target_user_id: targetId,
      target_email: targetEmail,
      details,
    });
  };

  try {
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
      const users = (profs ?? [])
        .map((p) => {
          const role = roles?.find((r) => r.user_id === p.user_id)?.role ?? "leitor";
          return {
            ...p,
            email: emails.get(p.user_id) ?? null,
            role,
            is_self: p.user_id === caller.id,
          };
        })
        // Sigilo hierárquico: não expõe usuários de nível igual ou superior ao do solicitante.
        .filter((p) => p.is_self || isOrgOwner || callerRank > (RANK[p.role as string] ?? 0));
      return json({ ok: true, users, org_owner_id: orgOwnerId });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const role = String(body.role || "leitor");
      if (!email) return json({ error: "E-mail obrigatório." }, 400);
      if (!ROLES.includes(role)) return json({ error: "Perfil inválido." }, 400);
      if (!isOrgOwner && (RANK[role] ?? 0) >= callerRank) {
        return json({ error: "Você não pode criar um usuário de nível igual ou superior ao seu." }, 403);
      }

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

      await log("create_user", newId, email, { role, allowed_modules: body.allowed_modules ?? [] });
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

    // Sigilo hierárquico: nunca agir sobre alguém de nível igual ou superior.
    const targetRank = await rankOf(targetId);
    if (!isOrgOwner && targetRank >= callerRank) {
      return json({ error: "Você não pode acessar dados de um usuário de nível igual ou superior ao seu." }, 403);
    }

    const { data: targetAuth } = await admin.auth.admin.getUserById(targetId);
    const targetEmail = targetAuth?.user?.email ?? null;

    if (action === "reset_password") {
      const { error } = await admin.auth.admin.updateUserById(targetId, { password: DEFAULT_PASSWORD });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ must_change_password: true }).eq("user_id", targetId);
      await log("reset_password", targetId, targetEmail, {});
      return json({ ok: true, temp_password: DEFAULT_PASSWORD });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 400);
      await log("delete_user", targetId, targetEmail, {});
      return json({ ok: true });
    }

    if (action === "log") {
      const kind = String(body.log_action || "");
      if (!LOGGABLE.includes(kind)) return json({ error: "Ação de log inválida." }, 400);
      await log(kind, targetId, targetEmail, (body.details as Record<string, unknown>) ?? {});
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
