import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, fileName } = await req.json();

    if (!fileId || typeof fileId !== "string") {
      return new Response(
        JSON.stringify({ error: "fileId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("GOOGLE_API_KEY");
    let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    if (API_KEY) {
      downloadUrl += `&key=${API_KEY}`;
    }

    const fileResponse = await fetch(downloadUrl, {
      headers: {
        "Accept": "application/pdf",
        "User-Agent": "Mozilla/5.0 (compatible; InvoiceParser/1.0)",
      },
    });

    if (!fileResponse.ok) {
      const errText = await fileResponse.text();
      console.error("Download error:", fileResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao baixar o arquivo. Verifique se está compartilhado publicamente." }),
        { status: fileResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBytes = await fileResponse.arrayBuffer();
    const bytes = new Uint8Array(pdfBytes);

    // Extract text from PDF (simple extraction)
    const decoder = new TextDecoder("latin1");
    const rawText = decoder.decode(bytes);

    let text = "";
    const textMatches = rawText.match(/\(([^)]+)\)/g);
    if (textMatches) {
      text = textMatches.map((m: string) => m.slice(1, -1)).join(" ");
    }
    const readableSegments = rawText.match(/[A-Za-zÀ-ÿ0-9\s.,;:\/\-@#$%&*()+=]{10,}/g);
    if (readableSegments) {
      text += "\n" + readableSegments.join("\n");
    }

    if (!text.trim()) {
      text = "Não foi possível extrair texto do PDF.";
    }

    // Now call parse-invoice logic inline (same AI call)
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
Para datas, use formato DD/MM/AAAA.

REGRAS IMPORTANTES:
- valor_total: É o VALOR TOTAL A PAGAR da fatura. Procure "Total a Pagar", "Valor a Pagar", "TOTAL". NUNCA retorne 0.
- valor_energia: É o valor da linha "Consumo-TE" ou "Energia Elétrica-TE" nos itens da fatura.
- valor_distribuicao: É o valor da linha "Consumo-TUSD" ou "Distribuição-TUSD" nos itens da fatura.
- contrib_iluminacao: É o valor de "Ilum. Públ. Municipal" ou "CIP/COSIP".
- Se valor_total não estiver explícito, SOME: valor_energia + valor_distribuicao + icms + pis + cofins + contrib_iluminacao + valor_bandeira.
- consumo_kwh: Use o valor em kWh do mês de referência (não confunda com quantidade faturada).`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extraia todos os dados desta fatura de energia:\n\nArquivo: ${fileName || "fatura.pdf"}\n\n${text}` },
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
                  titular: { type: "string" },
                  cpf_cnpj: { type: "string" },
                  endereco: { type: "string" },
                  numero_instalacao: { type: "string" },
                  mes_referencia: { type: "string" },
                  data_vencimento: { type: "string" },
                  consumo_kwh: { type: "number" },
                  valor_energia: { type: "number" },
                  valor_distribuicao: { type: "number" },
                  icms: { type: "number" },
                  pis: { type: "number" },
                  cofins: { type: "number" },
                  contrib_iluminacao: { type: "number" },
                  bandeira_tarifaria: { type: "string" },
                  valor_bandeira: { type: "number" },
                  valor_total: { type: "number" },
                  historico_consumo: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { mes: { type: "string" }, consumo_kwh: { type: "number" }, valor: { type: "number" } },
                    },
                  },
                  itens_fatura: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { descricao: { type: "string" }, quantidade: { type: "string" }, preco_unitario: { type: "number" }, valor: { type: "number" } },
                    },
                  },
                },
                required: ["valor_total"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar fatura com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "IA não retornou dados estruturados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoiceData = JSON.parse(toolCall.function.arguments);

    // Fallback: if valor_total is 0, null, or missing, calculate from components
    if (!invoiceData.valor_total || invoiceData.valor_total === 0) {
      const sum = [
        invoiceData.valor_energia,
        invoiceData.valor_distribuicao,
        invoiceData.icms,
        invoiceData.pis,
        invoiceData.cofins,
        invoiceData.contrib_iluminacao,
        invoiceData.valor_bandeira,
      ]
        .filter((v: unknown) => typeof v === "number" && v > 0)
        .reduce((a: number, b: number) => a + b, 0);

      if (sum > 0) {
        invoiceData.valor_total = Math.round(sum * 100) / 100;
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: invoiceData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("download-drive-file error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
