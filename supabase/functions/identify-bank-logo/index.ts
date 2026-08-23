import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u, error: ue } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (ue || !u?.user) return json({ error: "Unauthorized" }, 401);

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) return json({ error: "imageBase64 obrigatório" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "IA indisponível" }, 500);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você identifica instituições financeiras brasileiras pela logomarca/cabeçalho de extratos. " +
              'Responda APENAS um JSON: {"banco":"nome","codigo":"000","confianca":0.0}. ' +
              'Se não reconhecer, use {"banco":null,"codigo":null,"confianca":0}.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Qual banco emitiu este extrato? Use a logo e o cabeçalho." },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (resp.status === 429) return json({ error: "Limite de requisições da IA excedido. Tente novamente." }, 429);
    if (resp.status === 402) return json({ error: "Créditos de IA insuficientes." }, 402);
    if (!resp.ok) return json({ error: `Falha na IA (${resp.status})` }, 502);

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return json({ banco: null, codigo: null, confianca: 0 });
    return json(JSON.parse(match[0]));
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
