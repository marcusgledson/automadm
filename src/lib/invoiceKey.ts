// Helpers para evitar duplicidade de faturas e padronizar referência mês/ano

const MONTHS: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

/** Normaliza "MAR/2025", "março/2025", "03/2025", "2025-03" → "03/2025" */
export function normalizeMesReferencia(raw?: string | null): string {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  // 03/2025 ou 3/25
  let m = s.match(/^(\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const yy = m[2].length === 2 ? `20${m[2]}` : m[2];
    return `${mm}/${yy}`;
  }
  // 2025-03 ou 2025/03
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})$/);
  if (m) return `${m[2].padStart(2, "0")}/${m[1]}`;
  // mar/2025, março2025, mar2025
  m = s.match(/^([a-zç]+)[\/\-.]?(\d{2,4})$/);
  if (m) {
    const key = m[1].slice(0, 3);
    const mm = MONTHS[key];
    const yy = m[2].length === 2 ? `20${m[2]}` : m[2];
    if (mm) return `${mm}/${yy}`;
  }
  return String(raw).trim();
}

export interface InvoiceKeyInput {
  fileName?: string;
  numero_instalacao?: string;
  mes_referencia?: string;
}

/** Chave única por instalação + mês/ano (fallback para fileName) */
export function getInvoiceKey(inv: InvoiceKeyInput): string {
  const ref = normalizeMesReferencia(inv.mes_referencia);
  const inst = (inv.numero_instalacao || "").trim();
  if (inst && ref) return `${inst}::${ref}`;
  return `file::${(inv.fileName || "").trim().toLowerCase()}`;
}
