import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, unknown>;

interface Dataset {
  /** Nome amigável da aba/seção. */
  name: string;
  rows: Row[];
}

interface ModuleSource {
  table: string;
  name: string;
  order: string;
  filter?: { column: string; value: string };
}

/** De onde vêm os dados de cada módulo do relatório. */
const MODULE_SOURCES: Record<string, ModuleSource[]> = {
  extrato: [{ table: "bank_statements", name: "Extrato bancário", order: "data" }],
  contas: [
    { table: "consumption_bills", name: "Faturas de consumo", order: "data_vencimento" },
    { table: "expenses", name: "Despesas", order: "data_vencimento" },
  ],
  energia: [
    {
      table: "consumption_bills",
      name: "Faturas de energia",
      order: "data_vencimento",
      filter: { column: "tipo_conta", value: "energia" },
    },
  ],
  investimentos: [{ table: "investments", name: "Investimentos", order: "data_aplicacao" }],
  metas: [{ table: "budget_goals", name: "Metas e orçamento", order: "created_at" }],
  sms: [{ table: "sms_review_queue", name: "SMS bancários", order: "created_at" }],
};

/** Achata objetos/arrays para uma célula legível em planilha e CSV. */
function flatten(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const HIDDEN = new Set(["user_id", "raw", "raw_data", "id"]);

function normalize(rows: Row[]): Row[] {
  return rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      if (HIDDEN.has(k)) continue;
      out[k] = flatten(v);
    }
    return out;
  });
}

export async function fetchReportData(modulo: string): Promise<Dataset[]> {
  const sources = MODULE_SOURCES[modulo];
  if (!sources) throw new Error("Módulo sem relatório disponível.");

  const out: Dataset[] = [];
  for (const s of sources) {
    let query = supabase
      .from(s.table as never)
      .select("*")
      .order(s.order, { ascending: false })
      .limit(5000);
    if (s.filter) query = query.eq(s.filter.column, s.filter.value) as typeof query;
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    out.push({ name: s.name, rows: (data as Row[]) ?? [] });
  }
  return out;
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
}

export interface ReportResult {
  fileName: string;
  total: number;
}

/**
 * Gera e baixa o relatório aprovado do módulo no formato pedido.
 * Os dados respeitam a RLS: só vem o que o usuário pode ler.
 */
export async function generateReport(
  modulo: string,
  formato: string,
  meta?: { titulo?: string },
): Promise<ReportResult> {
  const datasets = await fetchReportData(modulo);
  const total = datasets.reduce((s, d) => s + d.rows.length, 0);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `relatorio-${modulo}-${stamp}`;

  if (formato === "json") {
    const payload = {
      modulo,
      gerado_em: new Date().toISOString(),
      conjuntos: datasets.map((d) => ({ nome: d.name, registros: d.rows })),
    };
    download(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `${base}.json`,
    );
    return { fileName: `${base}.json`, total };
  }

  if (formato === "csv") {
    const parts = datasets.map((d) => `# ${d.name}\n${toCsv(normalize(d.rows))}`);
    download(new Blob(["\uFEFF" + parts.join("\n\n")], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
    return { fileName: `${base}.csv`, total };
  }

  if (formato === "xlsx") {
    const wb = XLSX.utils.book_new();
    for (const d of datasets) {
      const ws = XLSX.utils.json_to_sheet(normalize(d.rows));
      XLSX.utils.book_append_sheet(wb, ws, d.name.substring(0, 31));
    }
    XLSX.writeFile(wb, `${base}.xlsx`);
    return { fileName: `${base}.xlsx`, total };
  }

  // PDF
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(meta?.titulo ?? `Relatório · ${modulo}`, 40, 40);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${total} registro(s)`, 40, 56);

  let startY = 76;
  for (const d of datasets) {
    const rows = normalize(d.rows);
    const cols = rows.length ? Object.keys(rows[0]) : [];
    doc.setFontSize(11);
    doc.text(d.name, 40, startY);
    autoTable(doc, {
      startY: startY + 8,
      head: [cols],
      body: rows.map((r) => cols.map((c) => String(r[c] ?? ""))),
      styles: { fontSize: 6, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [92, 107, 60] },
      margin: { left: 40, right: 40 },
    });
    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
    if (startY > 500) {
      doc.addPage();
      startY = 60;
    }
  }
  doc.save(`${base}.pdf`);
  return { fileName: `${base}.pdf`, total };
}
