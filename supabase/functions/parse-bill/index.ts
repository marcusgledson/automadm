import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, string> = {
  energia: "fatura de energia elétrica (Neoenergia, Enel, Cemig, CPFL, Light, etc.)",
  internet: "fatura de internet/telefone (Vivo, Claro, Tim, Oi, Sky, etc.)",
  agua: "fatura de água/saneamento (Sabesp, Embasa, Cedae, Caesb, etc.)",
  gas: "fatura de gás encanado (Comgás, Naturgy, etc.)",
  telefone: "fatura de telefonia",
  iptu: "boleto/carnê de IPTU emitido pela prefeitura",
  ipva: "boleto de IPVA emitido pelo Detran/SEFAZ",
  taxa: "boleto de taxa municipal/estadual",
  outro: "boleto/fatura de consumo genérico",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, (Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!);
  const { data: u, error: ue } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (ue || !u?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }


  try {
    const { pdfText, fileName, tipo_conta = "outro" } = await req.json();
    if (!pdfText) {
      return new Response(JSON.stringify({ error: "pdfText obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof pdfText !== "string" || pdfText.length > 400000) {
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

    const tipoDesc = PROMPTS[tipo_conta] || PROMPTS.outro;

    const systemPrompt = `Você é especialista em extrair dados estruturados de ${tipoDesc}.
Extraia TODOS os dados possíveis. Use null para campos não encontrados.
- Valores monetários: número (245.67, não "R$ 245,67").
- Datas: formato DD/MM/AAAA.
- numero_instalacao: código da unidade consumidora, matrícula, contrato, inscrição imobiliária ou RENAVAM, conforme o tipo.
- data_vencimento: SEMPRE obrigatória — procure "Vencimento", "Pague até".
- valor_total: valor total a pagar. Nunca 0.
- mes_referencia: mês de referência ou competência.
- IDENTIFICAÇÃO DO EMISSOR/SACADOR (prioridade alta): em boletos e faturas,
  o "sacador"/"beneficiário"/"cedente"/"emissor" é quem VAI RECEBER o dinheiro
  (ex.: "Neoenergia Coelba", "Sabesp", "Prefeitura de X", "Vivo S.A.").
  Este NUNCA é o cliente/pagador. Se houver empresa de cobrança intermediária
  (ex.: "Assaí Cobrança", cartório), retorne o sacador ORIGINAL nesse caso.
- fornecedor: preencha com o sacador/beneficiário identificado.
- emissor_documento: CNPJ do sacador/beneficiário, se disponível.
- linha_digitavel/codigo_barras: quando visíveis no boleto.
- BOLETOS DE TRIBUTOS (IPTU, IPVA, taxas, ISS, alvará): leia com atenção redobrada.
  Extraia também: inscricao_imobiliaria, renavam, placa, exercicio (ano do tributo),
  cota/parcela (ex.: "03/10"), numero_documento/nosso_numero, contribuinte,
  valor_principal, desconto, multa, juros, correcao_monetaria, taxas_adicionais,
  outros_acrescimos, valor_venal, aliquota, data_emissao, vencimentos alternativos
  (lista de datas/valores quando o carnê apresenta cota única e parcelas).
- Quando existir "cota única" e "parcelamento", use como data_vencimento a data da
  parcela/cota efetivamente cobrada nesta via e registre as demais em vencimentos_alternativos.
- Detalhe cada linha da composição do valor em itens_fatura (descrição + valor).
- Nunca invente valores: campo não localizado deve ser null.`;


    const body = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Arquivo: ${fileName || "fatura.pdf"}\nTipo: ${tipo_conta}\n\n${pdfText}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_bill_data",
          description: "Extrai dados estruturados de uma conta/fatura/boleto de consumo",
          parameters: {
            type: "object",
            properties: {
              fornecedor: { type: "string", description: "Sacador/beneficiário do boleto (quem recebe)" },
              sacador: { type: "string", description: "Alias de fornecedor. Nome exato do beneficiário/cedente." },
              emissor_documento: { type: "string", description: "CNPJ do sacador/beneficiário" },
              linha_digitavel: { type: "string" },
              codigo_barras: { type: "string" },
              titular: { type: "string", description: "Pagador/cliente" },
              cpf_cnpj: { type: "string" },
              endereco: { type: "string" },
              numero_instalacao: { type: "string" },
              mes_referencia: { type: "string" },
              data_vencimento: { type: "string" },
              consumo: { type: "number" },
              unidade_consumo: { type: "string", description: "kWh, m³, Mbps, etc." },
              valor_total: { type: "number" },
              icms: { type: "number" },
              pis: { type: "number" },
              cofins: { type: "number" },
              iss: { type: "number" },
              contrib_iluminacao: { type: "number" },
              valor_bandeira: { type: "number" },
              bandeira_tarifaria: { type: "string" },
              itens_fatura: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    descricao: { type: "string" }, quantidade: { type: "string" },
                    preco_unitario: { type: "number" }, valor: { type: "number" },
                  },
                },
              },
              historico_consumo: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    mes: { type: "string" }, consumo: { type: "number" }, valor: { type: "number" },
                  },
                },
              },
              inscricao_imobiliaria: { type: "string" },
              renavam: { type: "string" },
              placa: { type: "string" },
              exercicio: { type: "string", description: "Ano de exercício do tributo" },
              cota: { type: "string", description: "Cota/parcela, ex.: 03/10 ou Cota única" },
              numero_documento: { type: "string", description: "Nosso número / número do documento" },
              contribuinte: { type: "string" },
              valor_principal: { type: "number" },
              desconto: { type: "number" },
              multa: { type: "number" },
              juros: { type: "number" },
              correcao_monetaria: { type: "number" },
              taxas_adicionais: { type: "number" },
              outros_acrescimos: { type: "number" },
              valor_venal: { type: "number" },
              aliquota: { type: "number" },
              data_emissao: { type: "string" },
              vencimentos_alternativos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    descricao: { type: "string" }, data_vencimento: { type: "string" }, valor: { type: "number" },
                  },
                },
              },
            },
            required: ["numero_instalacao", "data_vencimento", "valor_total"],

          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_bill_data" } },
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
          : "Erro ao processar fatura com IA";
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
    console.error("parse-bill error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
