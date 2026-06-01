import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { pdfText, fileName } = await req.json();

    if (!pdfText || typeof pdfText !== "string") {
      return new Response(
        JSON.stringify({ error: "pdfText is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um especialista em leitura de faturas de energia elétrica da Neoenergia (Coelba, Cosern, Celpe, Elektro).
Extraia TODOS os dados possíveis da fatura. Retorne os dados estruturados usando a função fornecida.
Se um campo não for encontrado no texto, use null.
Para valores monetários, use números (ex: 245.67, não "R$ 245,67").
Para datas, use formato DD/MM/AAAA.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Extraia todos os dados desta fatura de energia:\n\nArquivo: ${fileName || "fatura.pdf"}\n\n${pdfText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extrai dados estruturados de uma fatura de energia elétrica",
              parameters: {
                type: "object",
                properties: {
                  titular: { type: "string", description: "Nome do titular da conta" },
                  cpf_cnpj: { type: "string", description: "CPF ou CNPJ do titular" },
                  endereco: { type: "string", description: "Endereço da unidade consumidora" },
                  numero_instalacao: { type: "string", description: "Número da instalação/UC" },
                  numero_medidor: { type: "string", description: "Número do medidor" },
                  classe: { type: "string", description: "Classe (residencial, comercial, etc.)" },
                  subclasse: { type: "string", description: "Subclasse" },
                  modalidade_tarifaria: { type: "string", description: "Modalidade tarifária" },
                  tensao: { type: "string", description: "Tensão nominal" },
                  mes_referencia: { type: "string", description: "Mês de referência (ex: MAR/2025)" },
                  data_emissao: { type: "string", description: "Data de emissão" },
                  data_vencimento: { type: "string", description: "Data de vencimento" },
                  data_leitura_anterior: { type: "string", description: "Data da leitura anterior" },
                  data_leitura_atual: { type: "string", description: "Data da leitura atual" },
                  leitura_anterior: { type: "number", description: "Leitura anterior em kWh" },
                  leitura_atual: { type: "number", description: "Leitura atual em kWh" },
                  consumo_kwh: { type: "number", description: "Consumo total em kWh" },
                  consumo_ponta_kwh: { type: "number", description: "Consumo ponta em kWh" },
                  consumo_fora_ponta_kwh: { type: "number", description: "Consumo fora ponta em kWh" },
                  demanda_contratada: { type: "number", description: "Demanda contratada em kW" },
                  demanda_medida: { type: "number", description: "Demanda medida em kW" },
                  valor_energia: { type: "number", description: "Valor da energia em R$" },
                  valor_distribuicao: { type: "number", description: "Valor da distribuição/TUSD em R$" },
                  valor_encargos: { type: "number", description: "Valor dos encargos setoriais em R$" },
                  bandeira_tarifaria: { type: "string", description: "Bandeira tarifária vigente" },
                  valor_bandeira: { type: "number", description: "Valor adicional de bandeira em R$" },
                  icms: { type: "number", description: "Valor do ICMS em R$" },
                  pis: { type: "number", description: "Valor do PIS em R$" },
                  cofins: { type: "number", description: "Valor do COFINS em R$" },
                  contrib_iluminacao: { type: "number", description: "Contribuição de iluminação pública (CIP/COSIP) em R$" },
                  multa: { type: "number", description: "Multa por atraso em R$" },
                  juros: { type: "number", description: "Juros por atraso em R$" },
                  valor_total: { type: "number", description: "Valor total da fatura em R$" },
                  codigo_barras: { type: "string", description: "Código de barras para pagamento" },
                  chave_pix: { type: "string", description: "Chave PIX para pagamento" },
                  historico_consumo: {
                    type: "array",
                    description: "Histórico de consumo dos últimos meses",
                    items: {
                      type: "object",
                      properties: {
                        mes: { type: "string" },
                        consumo_kwh: { type: "number" },
                        valor: { type: "number" },
                      },
                    },
                  },
                  itens_fatura: {
                    type: "array",
                    description: "Itens discriminados da fatura",
                    items: {
                      type: "object",
                      properties: {
                        descricao: { type: "string" },
                        quantidade: { type: "string" },
                        preco_unitario: { type: "number" },
                        valor: { type: "number" },
                      },
                    },
                  },
                  observacoes: { type: "string", description: "Observações ou informações adicionais relevantes" },
                },
                required: ["valor_total"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "IA não retornou dados estruturados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoiceData = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, data: invoiceData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("parse-invoice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
