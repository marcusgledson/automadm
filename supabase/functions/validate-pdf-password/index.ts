import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore - pdfjs legacy build runs in Deno
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";
import { guardAndAudit, MAX_TEXT_CHARS } from "../_shared/fileGuard.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Tenta achar a dica de senha varrendo os bytes do PDF, pois em arquivos
 * protegidos o pdf.js não expõe metadados antes de abrir o documento.
 */
function findHintInBytes(bytes: Uint8Array): string | undefined {
  try {
    const raw = new TextDecoder("latin1").decode(bytes.subarray(0, 400_000));
    const re = /\/(?:Keywords|Subject|Title)\s*\(([^)]{3,200})\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const v = m[1].replace(/\\([()\\])/g, "$1").trim();
      if (/senha|password|cpf|cnpj/i.test(v)) return v;
    }
  } catch (_) { /* sem dica */ }
  return undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u, error: ue } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (ue || !u?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }


  try {
    const { fileId, password } = await req.json();
    if (!fileId || typeof fileId !== "string") {
      return new Response(
        JSON.stringify({ error: "fileId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const urls: string[] = [];
    if (API_KEY) urls.push(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`);
    urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`);

    let fileResponse: Response | null = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            "Accept": "application/pdf,application/octet-stream,*/*",
            "User-Agent": "Mozilla/5.0",
          },
          redirect: "follow",
        });
        const ct = res.headers.get("content-type") || "";
        if (res.ok && !ct.includes("text/html")) {
          fileResponse = res;
          break;
        }
        await res.text().catch(() => {});
      } catch (_) { /* try next */ }
    }

    if (!fileResponse) {
      return new Response(
        JSON.stringify({ error: "Não foi possível baixar o PDF para validação." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bytes = new Uint8Array(await fileResponse.arrayBuffer());

    const guard = await guardAndAudit(bytes, {
      kind: "pdf",
      declaredMime: fileResponse.headers.get("content-type"),
      source: "google-drive",
      userId: u.user.id,
      req,
    });
    if (!guard.ok) {
      return new Response(JSON.stringify({ success: false, error: guard.reason }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: bytes,
        password: password || "",
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
      });
      const pdfDoc = await loadingTask.promise;
      const encrypted = pdfDoc.numPages > 0; // load succeeded
      let hint: string | undefined;
      try {
        const meta = await pdfDoc.getMetadata();
        const info = (meta?.info ?? {}) as Record<string, unknown>;
        for (const v of [info.Keywords, info.Subject, info.Title]) {
          if (typeof v === "string" && /senha|password|cpf|cnpj/i.test(v)) { hint = v.trim(); break; }
        }
      } catch (_) { /* metadados indisponíveis */ }
      return new Response(
        JSON.stringify({ success: true, encrypted, numPages: pdfDoc.numPages, hint }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      if (lower.includes("password") || lower.includes("encrypt")) {
        return new Response(
          JSON.stringify({
            success: false,
            requiresPassword: true,
            hint: findHintInBytes(bytes),
            error: password
              ? "Senha do PDF incorreta. Verifique e tente novamente."
              : "Este PDF está protegido por senha. Informe a senha de visualização.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      }
      return new Response(
        JSON.stringify({ success: false, error: `Não foi possível abrir o PDF: ${msg}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
