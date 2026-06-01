import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIPO_LABEL: Record<string, string> = {
  energia: "energia elétrica residencial no Brasil",
  internet: "serviços de internet/banda larga residencial no Brasil",
  agua: "saneamento básico (água e esgoto) residencial no Brasil",
  gas: "gás encanado residencial no Brasil",
  telefone: "telefonia móvel/fixa no Brasil",
  iptu: "IPTU (Imposto Predial e Territorial Urbano) no Brasil",
  ipva: "IPVA (Imposto sobre Propriedade de Veículos) no Brasil",
  taxa: "taxas municipais no Brasil",
  outro: "contas de consumo residencial no Brasil",
};

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
    const { tipo_conta = "energia", anos = [] } = await req.json() as {
      tipo_conta?: string; anos?: number[];
    };
    const yearsList = (anos.length ? anos : [new Date().getFullYear()]).slice(0, 6);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const label = TIPO_LABEL[tipo_conta] || TIPO_LABEL.outro;

    const systemPrompt = `Você é um analista tributário brasileiro. Pesquise informações públicas atualizadas (sites como ANEEL, ANATEL, ARSESP, prefeituras, Receita Federal, IBGE, jornais econômicos) sobre a carga tributária de ${label} para os anos solicitados.
Retorne dados estruturados via função, com percentuais médios estimados de ICMS, PIS, COFINS, ISS e outras contribuições aplicáveis. Use 0 quando o tributo não se aplica. Inclua a fonte resumida em "fontes".`;

    const userMsg = `Para os anos: ${yearsList.join(", ")}.
Estime a carga tributária média percentual sobre a tarifa final de ${label} em cada ano e o percentual total de impostos embutidos.`;

    const body = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      tools: [{
        type: "function",
        function: {
          name: "report_taxes",
          description: "Carga tributária estimada por ano",
          parameters: {
            type: "object",
            properties: {
              anos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ano: { type: "number" },
                    icms_pct: { type: "number" },
                    pis_pct: { type: "number" },
                    cofins_pct: { type: "number" },
                    iss_pct: { type: "number" },
                    outros_pct: { type: "number" },
                    total_pct: { type: "number" },
                    observacao: { type: "string" },
                  },
                  required: ["ano", "total_pct"],
                },
              },
              fontes: { type: "string" },
            },
            required: ["anos"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "report_taxes" } },
    });

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("tax-research AI fail:", r.status, t.slice(0, 200));
      const msg = r.status === 429 ? "Limite de IA excedido."
        : r.status === 402 ? "Créditos de IA esgotados."
        : "Erro na pesquisa tributária.";
      return new Response(JSON.stringify({ error: msg }), {
        status: r.status === 429 || r.status === 402 ? r.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "IA não retornou dados" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, data: JSON.parse(args) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tax-research error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
