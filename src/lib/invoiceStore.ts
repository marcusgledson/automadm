// Lightweight localStorage-backed store for parsed Neoenergia invoices.
// Allows sharing invoices between the import page and the analytics page.

const STORAGE_KEY = "neoenergia.invoices";
const ARCHIVE_KEY = "neoenergia.invoices.archived";

export interface StoredInvoice {
  fileName: string;
  titular?: string;
  cpf_cnpj?: string;
  endereco?: string;
  numero_instalacao?: string;
  mes_referencia?: string;
  data_vencimento?: string;
  consumo_kwh?: number;
  valor_energia?: number;
  valor_distribuicao?: number;
  icms?: number;
  pis?: number;
  cofins?: number;
  contrib_iluminacao?: number;
  bandeira_tarifaria?: string;
  valor_bandeira?: number;
  valor_total?: number;
  itens_fatura?: { descricao: string; quantidade?: string; preco_unitario?: number; valor: number }[];
  historico_consumo?: { mes: string; consumo_kwh: number; valor?: number }[];
  [key: string]: unknown;
}

export function loadInvoices(): StoredInvoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredInvoice[]) : [];
  } catch {
    return [];
  }
}

export function saveInvoices(invoices: StoredInvoice[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.error("Failed to persist invoices", err);
  }
}

export function loadArchived(): StoredInvoice[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? (JSON.parse(raw) as StoredInvoice[]) : [];
  } catch {
    return [];
  }
}

export function archiveInvoices(invoices: StoredInvoice[]) {
  try {
    const existing = loadArchived();
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...existing, ...invoices]));
  } catch (err) {
    console.error("Failed to archive invoices", err);
  }
}

export function saveArchived(invoices: StoredInvoice[]) {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.error("Failed to save archived", err);
  }
}

/** Remove uma fatura arquivada por nome de arquivo. */
export function removeArchived(fileName: string) {
  const remaining = loadArchived().filter((i) => i.fileName !== fileName);
  saveArchived(remaining);
}

// Parse "MM/YYYY" or "Janeiro/2025" or "2025-01" etc. Returns YYYY-MM or null.
const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

export function parseMesReferencia(ref?: string): string | null {
  if (!ref) return null;
  const s = ref.trim().toLowerCase();
  // YYYY-MM
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  // MM/YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  // Mes/YYYY (textual)
  m = s.match(/^([a-zçã]+)[\/\s\-]+(\d{4})/);
  if (m) {
    const k = m[1].slice(0, 3);
    if (MESES[k]) return `${m[2]}-${MESES[k]}`;
  }
  return null;
}

export function formatMesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const labels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${labels[parseInt(m, 10) - 1]}/${y}`;
}
