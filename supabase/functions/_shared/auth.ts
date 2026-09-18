import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Valida o JWT do usuário chamador.
 * Usa a chave publicável quando SUPABASE_ANON_KEY não estiver disponível
 * (projetos com signing keys) e cai para a service role como último recurso.
 */
export async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const url = Deno.env.get("SUPABASE_URL")!;
  const key =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    console.error("Nenhuma chave Supabase disponível no ambiente da função");
    return null;
  }

  const sb = createClient(url, key);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) {
    console.error("Falha ao validar token:", error?.message);
    return null;
  }
  return data.user;
}
