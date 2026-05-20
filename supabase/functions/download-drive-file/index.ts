import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - pdfjs legacy build runs in Deno
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

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
    const { fileId, fileName, password } = await req.json();

    if (!fileId || typeof fileId !== "string") {
      return new Response(
        JSON.stringify({ error: "fileId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("GOOGLE_API_KEY");

    // Try multiple download strategies for public Drive files
    const urls: string[] = [];
    if (API_KEY) {
      urls.push(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`);
    }
    urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`);
    urls.push(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`);

    let fileResponse: Response | null = null;
    let lastErr = "";
    const attempts: { url: string; attempt: number; status: string; httpStatus?: number }[] = [];
    const MAX_RETRIES = 4;

    outer: for (const url of urls) {
      let delay = 800;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetch(url, {
            headers: {
              "Accept": "application/pdf,application/octet-stream,*/*",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            },
            redirect: "follow",
          });
          const ct = res.headers.get("content-type") || "";
          if (res.ok && !ct.includes("text/html")) {
            attempts.push({ url, attempt, status: "ok", httpStatus: res.status });
            fileResponse = res;
            break outer;
          }
          // Consume body to free resources
          await res.text().catch(() => {});
          const isHtml = ct.includes("text/html");
          const retriable = res.status === 403 || res.status === 429 || res.status >= 500 || isHtml;
          lastErr = isHtml ? `HTML block (${res.status})` : `HTTP ${res.status}`;
          attempts.push({
            url,
            attempt,
            status: retriable ? `retry: ${lastErr}` : `fail: ${lastErr}`,
            httpStatus: res.status,
          });
          console.warn(`Download attempt ${attempt} for ${url}: ${lastErr}`);
          if (!retriable) break; // try next URL
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2; // exponential backoff
          }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          attempts.push({ url, attempt, status: `error: ${lastErr}` });
          console.error(`Download attempt ${attempt} threw:`, lastErr);
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2;
          }
        }
      }
    }

    console.log("Download attempts log:", JSON.stringify(attempts));

    if (!fileResponse) {
      console.error("All download attempts failed:", lastErr);
      return new Response(
        JSON.stringify({
          error: "Erro ao baixar o arquivo após múltiplas tentativas. Verifique se está compartilhado como 'Qualquer pessoa com o link'.",
          attempts,
          lastError: lastErr,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBytes = await fileResponse.arrayBuffer();
    const bytes = new Uint8Array(pdfBytes);

    // Extract text using pdf.js (handles encrypted PDFs when password is provided)
    let text = "";
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: bytes,
        password: password || "",
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
      });
      const pdfDoc = await loadingTask.promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((it: { str?: string }) => (typeof it.str === "string" ? it.str : ""))
          .join(" ");
        pages.push(pageText);
      }
      text = pages.join("\n");
      console.log(`PDF extraído: ${pdfDoc.numPages} página(s), ${text.length} chars`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Erro ao abrir PDF com pdf.js:", msg);
      const lower = msg.toLowerCase();
      if (lower.includes("password") || lower.includes("encrypt")) {
        return new Response(
          JSON.stringify({
            error: password
              ? "Senha do PDF incorreta. Verifique e tente novamente."
              : "Este PDF está protegido por senha. Informe a senha de visualização e tente novamente.",
            requiresPassword: true,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Não foi possível ler o PDF: ${msg}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: "PDF aberto, mas sem texto extraível (pode ser apenas imagem/scan)." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const aiBody = JSON.stringify({
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
    });

    // Call AI with retry/backoff for 429 (rate limit) and 5xx
    let aiResponse: Response | null = null;
    let aiErrText = "";
    let aiStatus = 0;
    let delay = 1500;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: aiBody,
      });
      if (r.ok) { aiResponse = r; break; }
      aiStatus = r.status;
      aiErrText = await r.text().catch(() => "");
      console.warn(`AI attempt ${attempt} failed: ${r.status} ${aiErrText.slice(0, 200)}`);
      if (r.status === 402) break; // no retry on credits exhausted
      if (r.status !== 429 && r.status < 500) break;
      if (attempt < 5) {
        await new Promise((res) => setTimeout(res, delay + Math.random() * 500));
        delay *= 2;
      }
    }

    if (!aiResponse) {
      console.error("AI error final:", aiStatus, aiErrText);
      if (aiStatus === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições da IA excedido. Aguarde alguns segundos e tente processar menos faturas por vez." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiStatus === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      // Try summing known fields first
      let sum = [
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

      // If still 0, try summing itens_fatura + tributos
      if (sum === 0 && Array.isArray(invoiceData.itens_fatura)) {
        sum = invoiceData.itens_fatura
          .map((item: { valor?: number }) => item.valor || 0)
          .reduce((a: number, b: number) => a + b, 0);
        // Add tributos and contrib not in itens_fatura
        const extras = [invoiceData.icms, invoiceData.pis, invoiceData.cofins, invoiceData.contrib_iluminacao]
          .filter((v: unknown) => typeof v === "number" && v > 0)
          .reduce((a: number, b: number) => a + b, 0);
        sum += extras;
      }

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
