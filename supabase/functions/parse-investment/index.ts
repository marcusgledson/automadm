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
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, (Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!);
  const { data: u, error: ue } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (ue || !u?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { text, fileName } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "text obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof text !== "string" || text.length > 400000) {
      return new Response(JSON.stringify({ error: "Conteúdo excede o tamanho máximo permitido para análise." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é especialista em extratos e notas de investimentos brasileiros
(CDB, LCI, LCA, Tesouro Direto, Poupança, Fundos, LC, Debêntures, CRI/CRA, Ações, FIIs, Previdência).

Regras:
- O extrato pode conter VÁRIOS investimentos. Retorne TODOS em "investimentos".
- Valores monetários e percentuais como número (ex.: 1234.56 e 12.5 para 12,5%).
- Datas no formato DD/MM/AAAA.
- ativo: nome/identificação do papel (ex.: "CDB Banco X 2027", "Tesouro IPCA+ 2029").
- data_aplicacao é obrigatória; se só houver a data de início/compra, use-a.
- indexador: CDI, IPCA, SELIC, PREFIXADO, POUPANCA ou null.
- percentual_indexador: quando for "110% do CDI" use 110. Quando for "IPCA + 5,5%" coloque 5.5 em taxa_ao_ano.
- carencia_data / liquidez: prazo mínimo antes de poder resgatar (ex.: "D+0", "no vencimento", "diária após 90 dias").
- explicacao_simples: 2 a 4 frases em português claro para LEIGOS, explicando em que o dinheiro foi aplicado,
  quando ele pode ser resgatado, o que a taxa significa na prática e o que é descontado de imposto.
Se um dado não existir, use null. Nunca invente valores.`;

    const body = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Arquivo: ${fileName || "extrato"}\n\n${text}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_investments",
          description: "Extrai a lista de investimentos de um extrato/nota",
          parameters: {
            type: "object",
            properties: {
              investimentos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    instituicao: { type: "string" },
                    tipo_investimento: { type: "string" },
                    ativo: { type: "string" },
                    valor_aplicado: { type: "number" },
                    valor_bruto: { type: "number" },
                    valor_liquido: { type: "number" },
                    rendimento: { type: "number" },
                    data_aplicacao: { type: "string" },
                    data_vencimento: { type: "string" },
                    carencia_data: { type: "string" },
                    liquidez: { type: "string" },
                    indexador: { type: "string" },
                    percentual_indexador: { type: "number" },
                    taxa_ao_ano: { type: "number" },
                    taxa_contratada: { type: "string" },
                    rentabilidade_periodo: { type: "number" },
                    ir: { type: "number" },
                    iof: { type: "number" },
                    quantidade: { type: "number" },
                    preco_unitario: { type: "number" },
                    observacoes: { type: "string" },
                    explicacao_simples: { type: "string" },
                  },
                  required: ["ativo", "data_aplicacao"],
                },
              },
            },
            required: ["investimentos"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_investments" } },
    });

    let resp: Response | null = null;
    let lastStatus = 0, lastText = "";
    let delay = 1500;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body,
      });
      if (r.ok) { resp = r; break; }
      lastStatus = r.status;
      lastText = await r.text().catch(() => "");
      if (r.status !== 429 && r.status < 500) break;
      if (attempt < 5) {
        await new Promise((res) => setTimeout(res, delay + Math.random() * 500));
        delay *= 2;
      }
    }

    if (!resp) {
      const status = lastStatus === 429 || lastStatus === 402 ? lastStatus : 500;
      const msg = lastStatus === 429
        ? "Limite de IA excedido. Tente novamente em alguns segundos."
        : lastStatus === 402
          ? "Créditos de IA esgotados."
          : "Erro ao processar o extrato de investimentos";
      console.error("AI fail:", lastStatus, lastText.slice(0, 200));
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: JSON.parse(args) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-investment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
