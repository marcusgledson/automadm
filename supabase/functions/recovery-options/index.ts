import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Limite simples por IP: 5 consultas a cada 10 minutos. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_HITS;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const ini = local.slice(0, 3);
  const fim = local.length > 6 ? local.slice(-3) : "";
  return `${ini}${"*".repeat(Math.max(3, local.length - ini.length - fim.length))}${fim}@${domain}`;
}

function maskPhone(digits: string) {
  if (digits.length < 8) return null;
  return `${digits.slice(0, 4)}${"*".repeat(digits.length - 7)}${digits.slice(-3)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
  if (rateLimited(ip)) {
    return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
    return json({ error: "Informe um e-mail válido." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Resposta genérica: nunca revela se a conta existe além das opções mascaradas.
  const generic = { found: false as boolean, email: null as string | null, phone: null as string | null };

  const res = await fetch(
    `${url}/auth/v1/admin/users?per_page=1&filter=${encodeURIComponent(email)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) return json(generic);

  const data = (await res.json()) as { users?: { id: string; email?: string }[] };
  const user = (data.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
  if (!user) return json(generic);

  const admin = createClient(url, serviceKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("phone_area_code, phone_number, phone_is_whatsapp")
    .eq("user_id", user.id)
    .maybeSingle();

  const digits = `${profile?.phone_area_code ?? ""}${profile?.phone_number ?? ""}`.replace(/\D/g, "");
  return json({
    found: true,
    email: maskEmail(email),
    phone: profile?.phone_is_whatsapp && digits ? maskPhone(digits) : null,
  });
});
