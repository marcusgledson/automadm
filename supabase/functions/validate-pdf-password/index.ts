import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - pdfjs legacy build runs in Deno
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      return new Response(
        JSON.stringify({ success: true, encrypted, numPages: pdfDoc.numPages }),
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
