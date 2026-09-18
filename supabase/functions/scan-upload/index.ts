import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { guardAndAudit, MAX_PDF_BYTES, type FileKind } from "../_shared/fileGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-file-name, x-file-kind, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, (Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!);
  const { data: u, error: ue } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (ue || !u?.user) return json({ error: "Unauthorized" }, 401);

  try {
    const kindHeader = (req.headers.get("x-file-kind") || "").toLowerCase();
    if (kindHeader !== "pdf" && kindHeader !== "ofx") {
      return json({ ok: false, error: "Tipo de arquivo inválido (use pdf ou ofx)." }, 400);
    }
    const kind = kindHeader as FileKind;
    let fileName: string | undefined;
    const rawName = req.headers.get("x-file-name");
    if (rawName) {
      try { fileName = decodeURIComponent(rawName).slice(0, 300); }
      catch { fileName = rawName.slice(0, 300); }
    }

    const declaredLength = Number(req.headers.get("content-length") || "0");
    if (declaredLength > MAX_PDF_BYTES) {
      return json({ ok: false, error: "Arquivo excede o tamanho máximo permitido." }, 413);
    }

    const bytes = new Uint8Array(await req.arrayBuffer());
    const result = await guardAndAudit(bytes, {
      kind,
      fileName,
      declaredMime: req.headers.get("content-type"),
      source: "upload",
      userId: u.user.id,
      req,
    });

    if (!result.ok) {
      return json(
        {
          ok: false,
          error: result.reason,
          threats: result.scan?.threats ?? [],
          cached: !!result.cached,
          sha256: result.sha256,
        },
        422,
      );
    }
    return json({
      ok: true,
      engine: result.scan?.engine,
      size: bytes.byteLength,
      cached: !!result.cached,
      sha256: result.sha256,
    });
  } catch (error) {
    console.error("scan-upload error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
