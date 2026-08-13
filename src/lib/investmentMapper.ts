// Converte investimentos extraídos pela IA em payload para a tabela investments
// e gera explicações em linguagem simples para leigos.
import { parseDateBR } from "@/lib/billMapper";
import type { NewInvestmentInput, InvestmentSource } from "@/hooks/useInvestments";

export interface ExtractedInvestment {
  instituicao?: string;
  tipo_investimento?: string;
  ativo?: string;
  valor_aplicado?: number;
  valor_bruto?: number;
  valor_liquido?: number;
  rendimento?: number;
  data_aplicacao?: string;
  data_vencimento?: string;
  carencia_data?: string;
  liquidez?: string;
  indexador?: string;
  percentual_indexador?: number;
  taxa_ao_ano?: number;
  taxa_contratada?: string;
  rentabilidade_periodo?: number;
  ir?: number;
  iof?: number;
  quantidade?: number;
  preco_unitario?: number;
  observacoes?: string;
  explicacao_simples?: string;
  [k: string]: unknown;
}

export const GLOSSARIO: { termo: string; texto: string }[] = [
  { termo: "Data de aplicação", texto: "O dia em que o seu dinheiro entrou nesse investimento." },
  { termo: "Data de vencimento", texto: "O dia em que o investimento termina e o dinheiro volta para a conta, com os rendimentos." },
  { termo: "Carência", texto: "Um período inicial em que você NÃO pode tirar o dinheiro. Depois dele, o resgate é liberado." },
  { termo: "Liquidez", texto: "A rapidez com que você consegue transformar o investimento em dinheiro na conta. 'D+0' é no mesmo dia, 'D+1' no dia útil seguinte, 'no vencimento' só na data final." },
  { termo: "Indexador", texto: "O 'termômetro' que define o rendimento: CDI (segue os juros dos bancos), IPCA (segue a inflação), SELIC (juros básicos) ou Prefixado (taxa fixa combinada)." },
  { termo: "% do indexador", texto: "Quanto do termômetro você recebe. 110% do CDI significa que você ganha 10% a mais que o CDI do período." },
  { termo: "Rentabilidade no período", texto: "O quanto o dinheiro rendeu, em percentual, desde a aplicação até a data do extrato." },
  { termo: "Valor bruto", texto: "O total acumulado antes de descontar impostos." },
  { termo: "Valor líquido", texto: "O que realmente sobra para você depois dos impostos." },
  { termo: "IR", texto: "Imposto de Renda sobre o lucro. Quanto mais tempo o dinheiro fica aplicado, menor a alíquota (de 22,5% até 15%)." },
  { termo: "IOF", texto: "Imposto cobrado apenas quando o resgate acontece em menos de 30 dias. Depois disso, deixa de existir." },
];

const brl = (v?: number | null) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const dataBR = (iso?: string | null) =>
  iso ? iso.split("-").reverse().join("/") : null;

function explicaTaxa(e: ExtractedInvestment): string {
  const idx = (e.indexador || "").toUpperCase();
  const pct = e.percentual_indexador;
  const aa = e.taxa_ao_ano;
  if (idx.includes("CDI") && pct) {
    return `Rende ${pct}% do CDI. O CDI acompanha os juros que os bancos praticam entre si — se o CDI render 10% no ano, você receberia cerca de ${((pct / 100) * 10).toFixed(1)}% nesse mesmo ano.`;
  }
  if (idx.includes("IPCA")) {
    return `Rende a inflação (IPCA)${aa ? ` mais ${aa}% ao ano` : ""}. Ou seja, o dinheiro não perde poder de compra e ainda ganha um extra por cima.`;
  }
  if (idx.includes("SELIC")) {
    return "Acompanha a taxa Selic, os juros básicos do país. Sobe e desce junto com ela.";
  }
  if (idx.includes("PRE") || (!idx && aa)) {
    return `Taxa fixa${aa ? ` de ${aa}% ao ano` : ""}: você já sabe hoje quanto vai receber no vencimento, independente do que acontecer com os juros.`;
  }
  if (e.taxa_contratada) return `Taxa contratada: ${e.taxa_contratada}.`;
  return "A taxa não estava clara no arquivo — vale conferir no extrato original.";
}

function explicaResgate(e: ExtractedInvestment, carencia: string | null, venc: string | null): string {
  const liq = (e.liquidez || "").toLowerCase();
  if (carencia) return `Você só pode resgatar a partir de ${dataBR(carencia)} (período de carência). Antes disso o dinheiro fica preso.`;
  if (liq.includes("d+0") || liq.includes("diár") || liq.includes("diar")) {
    return "Liquidez diária: dá para resgatar quando quiser, o dinheiro cai na conta no mesmo dia ou no dia útil seguinte.";
  }
  if (liq.includes("vencimento") || (!liq && venc)) {
    return `O resgate acontece no vencimento${venc ? `, em ${dataBR(venc)}` : ""}. Tirar antes pode não ser possível ou sair com deságio (valor menor).`;
  }
  if (liq) return `Condição de resgate informada: ${e.liquidez}.`;
  return "O extrato não informou a condição de resgate — confirme com a instituição.";
}

function explicaImpostos(e: ExtractedInvestment): string {
  const partes: string[] = [];
  if (typeof e.ir === "number" && e.ir > 0) partes.push(`${brl(e.ir)} de Imposto de Renda sobre o lucro`);
  if (typeof e.iof === "number" && e.iof > 0) partes.push(`${brl(e.iof)} de IOF (cobrado em resgates com menos de 30 dias)`);
  if (partes.length === 0) {
    return "Nenhum imposto foi destacado neste extrato. Lembre-se: em geral o IR incide só sobre o lucro, e cai de 22,5% para 15% conforme o tempo de aplicação.";
  }
  return `Descontos: ${partes.join(" e ")}.`;
}

/** Monta o bloco de explicações para leigos. */
export function buildExplicacao(e: ExtractedInvestment, carencia: string | null, venc: string | null) {
  const aplicado = e.valor_aplicado;
  const liquido = e.valor_liquido ?? e.valor_bruto;
  const ganho =
    typeof liquido === "number" && typeof aplicado === "number" ? liquido - aplicado : e.rendimento;

  return {
    resumo:
      e.explicacao_simples ||
      `Você aplicou ${brl(aplicado)} em ${e.ativo || "um investimento"}${
        e.instituicao ? ` na ${e.instituicao}` : ""
      }. Hoje esse valor está em ${brl(liquido)}${
        typeof ganho === "number" ? `, um ganho de ${brl(ganho)}` : ""
      }.`,
    taxa: explicaTaxa(e),
    resgate: explicaResgate(e, carencia, venc),
    impostos: explicaImpostos(e),
    ganho: typeof ganho === "number" ? ganho : null,
  };
}

export function toInvestmentRow(
  e: ExtractedInvestment,
  opts: { fileName?: string; source?: InvestmentSource; instituicao?: string }
): NewInvestmentInput | { error: string } {
  const ativo = (e.ativo || "").trim();
  const dataAplicacao = parseDateBR(e.data_aplicacao);
  if (!ativo) return { error: "Ativo não identificado" };
  if (!dataAplicacao) return { error: "Data de aplicação não identificada" };

  const venc = parseDateBR(e.data_vencimento);
  const carencia = parseDateBR(e.carencia_data);
  const instituicao = (opts.instituicao?.trim() || e.instituicao || "").trim();

  const taxaContratada =
    e.taxa_contratada ||
    (e.percentual_indexador && e.indexador
      ? `${e.percentual_indexador}% do ${e.indexador}`
      : e.taxa_ao_ano
        ? `${e.taxa_ao_ano}% a.a.${e.indexador ? ` + ${e.indexador}` : ""}`
        : null);

  return {
    instituicao,
    tipo_investimento: (e.tipo_investimento || "").trim(),
    ativo,
    valor_aplicado: e.valor_aplicado ?? null,
    valor_bruto: e.valor_bruto ?? null,
    valor_liquido: e.valor_liquido ?? null,
    rendimento: e.rendimento ?? null,
    data_aplicacao: dataAplicacao,
    data_vencimento: venc,
    data_carencia: carencia,
    liquidez: e.liquidez ?? null,
    indexador: e.indexador ?? null,
    percentual_indexador: e.percentual_indexador ?? null,
    taxa_contratada: taxaContratada,
    rentabilidade_periodo: e.rentabilidade_periodo ?? null,
    ir: e.ir ?? null,
    iof: e.iof ?? null,
    quantidade: e.quantidade ?? null,
    preco_unitario: e.preco_unitario ?? null,
    observacoes: e.observacoes ?? null,
    explicacao: buildExplicacao(e, carencia, venc) as unknown as Record<string, unknown>,
    raw: e as unknown as Record<string, unknown>,
    file_name: opts.fileName ?? null,
    source: opts.source ?? "upload",
  };
}
