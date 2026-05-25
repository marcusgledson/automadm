// Converte dados de fatura extraídos pela IA em payload para a tabela consumption_bills
import type { NewBillInput, BillType, BillSource } from "@/hooks/useConsumptionBills";

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

/** Converte data BR (DD/MM/YYYY ou similar) em YYYY-MM-DD */
export function parseDateBR(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${mo}-${d}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

/** Normaliza referência para "MM/YYYY" */
export function normalizeRef(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  let m = s.match(/^(\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const yy = m[2].length === 2 ? `20${m[2]}` : m[2];
    return `${mm}/${yy}`;
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})$/);
  if (m) return `${m[2].padStart(2, "0")}/${m[1]}`;
  m = s.match(/^([a-zç]+)[\/\-.]?(\d{2,4})$/);
  if (m) {
    const mm = MESES[m[1].slice(0, 3)];
    const yy = m[2].length === 2 ? `20${m[2]}` : m[2];
    if (mm) return `${mm}/${yy}`;
  }
  return String(raw).trim();
}

export interface ExtractedInvoice {
  titular?: string; cpf_cnpj?: string; endereco?: string;
  numero_instalacao?: string;
  mes_referencia?: string; data_vencimento?: string;
  consumo_kwh?: number; consumo?: number;
  valor_total?: number;
  icms?: number; pis?: number; cofins?: number; iss?: number;
  contrib_iluminacao?: number; valor_bandeira?: number;
  bandeira_tarifaria?: string;
  itens_fatura?: Array<Record<string, unknown>>;
  historico_consumo?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

export function toBillRow(
  inv: ExtractedInvoice,
  opts: { fileName: string; tipo_conta: BillType; fornecedor?: string; source: BillSource }
): NewBillInput | { error: string } {
  const codigo = String(inv.numero_instalacao || "").trim();
  const venc = parseDateBR(inv.data_vencimento);
  if (!codigo) return { error: "Código de Instalação não encontrado na fatura" };
  if (!venc) return { error: "Data de Vencimento não encontrada na fatura" };

  const impostos: Record<string, number> = {};
  for (const k of ["icms", "pis", "cofins", "iss", "contrib_iluminacao", "valor_bandeira"] as const) {
    const v = inv[k];
    if (typeof v === "number") impostos[k] = v;
  }

  const unidade =
    opts.tipo_conta === "energia" ? "kWh"
      : opts.tipo_conta === "agua" ? "m³"
      : opts.tipo_conta === "gas" ? "m³"
      : opts.tipo_conta === "internet" ? "Mbps"
      : "";

  return {
    tipo_conta: opts.tipo_conta,
    fornecedor: opts.fornecedor ?? null,
    codigo_instalacao: codigo,
    titular: inv.titular ?? null,
    cpf_cnpj: inv.cpf_cnpj ?? null,
    endereco: inv.endereco ?? null,
    mes_referencia: normalizeRef(inv.mes_referencia),
    data_vencimento: venc,
    valor_total: typeof inv.valor_total === "number" ? inv.valor_total : null,
    consumo: typeof inv.consumo_kwh === "number" ? inv.consumo_kwh
      : typeof inv.consumo === "number" ? inv.consumo : null,
    unidade_consumo: unidade,
    impostos,
    itens: Array.isArray(inv.itens_fatura) ? inv.itens_fatura : [],
    historico: Array.isArray(inv.historico_consumo) ? inv.historico_consumo : [],
    raw_data: inv as Record<string, unknown>,
    file_name: opts.fileName,
    source: opts.source,
  };
}
