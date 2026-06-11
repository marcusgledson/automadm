import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u, error: ue } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (ue || !u?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { fileId } = await req.json();
    if (!fileId || typeof fileId !== "string") {
      return new Response(JSON.stringify({ error: "fileId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const urls: string[] = [];
    if (API_KEY) urls.push(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`);
    urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`);
    urls.push(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`);

    let fileResponse: Response | null = null;
    let lastErr = "";
    outer: for (const url of urls) {
      let delay = 600;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const res = await fetch(url, {
            headers: {
              "Accept": "application/x-ofx,text/plain,application/octet-stream,*/*",
              "User-Agent": "Mozilla/5.0",
            },
            redirect: "follow",
          });
          const ct = res.headers.get("content-type") || "";
          if (res.ok && !ct.includes("text/html")) { fileResponse = res; break outer; }
          await res.text().catch(() => {});
          lastErr = `HTTP ${res.status}${ct.includes("text/html") ? " (HTML)" : ""}`;
          const retriable = res.status === 403 || res.status === 429 || res.status >= 500 || ct.includes("text/html");
          if (!retriable) break;
          if (attempt < 4) { await new Promise((r) => setTimeout(r, delay)); delay *= 2; }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (attempt < 4) { await new Promise((r) => setTimeout(r, delay)); delay *= 2; }
        }
      }
    }

    if (!fileResponse) {
      return new Response(JSON.stringify({
        error: "Não foi possível baixar o OFX. Verifique se a pasta está compartilhada como 'Qualquer pessoa com o link'.",
        lastError: lastErr,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const buf = await fileResponse.arrayBuffer();
    // OFX é texto (latin1/utf-8). Decodifica tolerante.
    let text = "";
    try { text = new TextDecoder("utf-8").decode(buf); }
    catch { text = new TextDecoder("latin1").decode(buf); }
    if (!text || !/<OFX|OFXHEADER/i.test(text)) {
      // tenta latin1 caso utf-8 não tenha pegado
      text = new TextDecoder("latin1").decode(buf);
    }

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "Arquivo OFX vazio." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("download-drive-ofx error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
