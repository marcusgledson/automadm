import * as XLSX from "xlsx";
import Papa from "papaparse";

export interface FinancialRecord {
  data: string;
  descricao: string;
  valor: number;
  tipo: string;
  categoria: string;
  documento?: string;
  raw: Record<string, unknown>;
}

// ── Helpers ──────────────────────────────────────────────────

function normalize(col: string): string {
  return col
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function detectColumn(headers: string[], keywords: string[]): string | null {
  for (const h of headers) {
    const n = normalize(h);
    if (keywords.some((k) => n.includes(k))) return h;
  }
  return null;
}

/** Parse a Brazilian monetary value like "1.234,56" or "-1234.56" */
function parseBRValue(raw: unknown): number {
  if (typeof raw === "number" && !isNaN(raw)) return raw;
  if (raw == null) return 0;

  let s = String(raw).trim();

  // Detect sign from parentheses: (1.234,56) → negative
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.replace(/[()]/g, "");
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.replace(/^-/, "");
  }
  // Also handle "D" / "C" suffix used by some banks
  if (/[dD]$/.test(s)) {
    negative = true;
    s = s.replace(/[dD]$/, "");
  } else {
    s = s.replace(/[cC]$/, "");
  }

  // Remove currency symbols and spaces
  s = s.replace(/[R$\s]/g, "");

  if (!s) return 0;

  // Detect Brazilian format: dots as thousands, comma as decimal
  // e.g. "1.234,56" or "1.234.567,89"
  const hasDotAndComma = s.includes(".") && s.includes(",");
  const commaPos = s.lastIndexOf(",");
  const dotPos = s.lastIndexOf(".");

  let num: number;

  if (hasDotAndComma) {
    // Both present: last separator is decimal
    if (commaPos > dotPos) {
      // Brazilian: 1.234,56
      num = parseFloat(s.replace(/\./g, "").replace(",", "."));
    } else {
      // US: 1,234.56
      num = parseFloat(s.replace(/,/g, ""));
    }
  } else if (s.includes(",")) {
    // Only comma: check if it's a decimal separator
    const afterComma = s.split(",")[1];
    if (afterComma && afterComma.length <= 2) {
      // Likely decimal: 1234,56
      num = parseFloat(s.replace(",", "."));
    } else {
      // Likely thousands: 1,234,567
      num = parseFloat(s.replace(/,/g, ""));
    }
  } else {
    num = parseFloat(s.replace(/[^\d.]/g, ""));
  }

  if (isNaN(num)) return 0;
  return negative ? -num : num;
}

/** Format a date string to DD/MM/YYYY when possible */
function normalizeDate(raw: unknown): string {
  if (raw == null) return "";
  if (raw instanceof Date) {
    const d = raw;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  const s = String(raw).trim();
  if (!s) return "";

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // DDMMYYYY (no separators, 8 digits)
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4, 8)}`;
  // DD/MM/YY
  const short = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(s);
  if (short) {
    const y = parseInt(short[3]);
    const fullYear = y > 50 ? 1900 + y : 2000 + y;
    return `${short[1]}/${short[2]}/${fullYear}`;
  }

  return s;
}

function classifyType(valor: number): string {
  if (valor > 0) return "Crédito";
  if (valor < 0) return "Débito";
  return "Neutro";
}

function classifyCategory(descricao: string): string {
  const d = descricao.toLowerCase();
  if (d.includes("pix")) return "PIX";
  if (d.includes("ted") || d.includes("doc")) return "Transferência";
  if (d.includes("boleto")) return "Boleto";
  if (d.includes("tarifa") || d.includes("taxa") || d.includes("iof")) return "Tarifa";
  if (d.includes("salario") || d.includes("salário") || d.includes("pagamento") || d.includes("pgto")) return "Pagamento";
  if (d.includes("saque")) return "Saque";
  if (d.includes("deposito") || d.includes("depósito")) return "Depósito";
  if (d.includes("compra") || d.includes("debito automatico") || d.includes("débito automático")) return "Compra";
  if (d.includes("juros") || d.includes("rendimento") || d.includes("aplicacao") || d.includes("aplicação")) return "Rendimento";
  if (d.includes("estorno") || d.includes("devolucao") || d.includes("devolução")) return "Estorno";
  if (d.includes("cheque")) return "Cheque";
  return "Outros";
}

// ── Row normalization (shared by XLSX, CSV, TXT) ────────────

function rowsToRecords(rows: Record<string, unknown>[]): FinancialRecord[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);

  const dateCol = detectColumn(headers, ["data", "date", "dt", "lancamento", "lançamento", "datalancamento", "dtlancamento", "dtmovimento", "datamovimento"]);
  const descCol = detectColumn(headers, ["descricao", "descrição", "historico", "histórico", "memo", "detail", "description", "lancamento", "complemento"]);
  const valueCol = detectColumn(headers, ["valor", "value", "amount", "quantia", "vlr", "montante", "vlrmovimento", "vlrlancamento"]);
  const docCol = detectColumn(headers, ["documento", "doc", "nrdoc", "numero", "numdocumento"]);

  // Try to detect separate credit/debit columns
  const creditCol = detectColumn(headers, ["credito", "crédito", "credit", "entrada", "vlrcredito"]);
  const debitCol = detectColumn(headers, ["debito", "débito", "debit", "saida", "vlrdebito"]);

  return rows
    .map((row) => {
      let valor: number;

      if (valueCol) {
        valor = parseBRValue(row[valueCol]);
      } else if (creditCol || debitCol) {
        // Merge credit/debit columns
        const cred = creditCol ? parseBRValue(row[creditCol]) : 0;
        const deb = debitCol ? parseBRValue(row[debitCol]) : 0;
        valor = cred > 0 ? cred : deb !== 0 ? -Math.abs(deb) : 0;
      } else {
        valor = 0;
      }

      const descricao = descCol ? String(row[descCol] ?? "").trim() : "";
      const data = normalizeDate(dateCol ? row[dateCol] : "");

      return {
        data,
        descricao,
        valor,
        tipo: classifyType(valor),
        categoria: classifyCategory(descricao),
        documento: docCol ? String(row[docCol] ?? "").trim() : undefined,
        raw: row as Record<string, unknown>,
      };
    })
    .filter((r) => r.descricao || r.valor !== 0);
}

// ── XLSX / XLS ──────────────────────────────────────────────

export function parseXLSX(buffer: ArrayBuffer): FinancialRecord[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const allRecords: FinancialRecord[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" });
    allRecords.push(...rowsToRecords(rows));
  }
  return allRecords;
}

// ── CSV ─────────────────────────────────────────────────────

function detectDelimiter(text: string): string {
  const firstLines = text.split("\n").slice(0, 5).join("\n");
  const delimiters = [";", "\t", ",", "|"];
  let best = ",";
  let maxCount = 0;
  for (const d of delimiters) {
    const escaped = d === "\t" ? "\\t" : "\\" + d;
    const count = (firstLines.match(new RegExp(escaped, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      best = d;
    }
  }
  return best;
}

export function parseCSV(text: string): FinancialRecord[] {
  // Skip leading non-header lines (some bank CSVs have metadata lines)
  const lines = text.split("\n");
  let startIndex = 0;
  const delimiter = detectDelimiter(text);

  // Heuristic: find the first line that looks like a header (has multiple delimiter-separated words)
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const parts = lines[i].split(delimiter);
    if (parts.length >= 3) {
      const hasLetterCols = parts.filter((p) => /[a-zA-ZÀ-ú]/.test(p.trim())).length >= 2;
      if (hasLetterCols) {
        startIndex = i;
        break;
      }
    }
  }

  const csvText = lines.slice(startIndex).join("\n");

  const result = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep as strings so we control number parsing
    delimiter,
  });
  return rowsToRecords(result.data);
}

// ── OFX ─────────────────────────────────────────────────────

export function parseOFX(text: string): FinancialRecord[] {
  const records: FinancialRecord[] = [];
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = txRegex.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const valor = parseBRValue(get("TRNAMT"));
    const descricao = get("MEMO") || get("NAME") || "";
    const dtStr = get("DTPOSTED");
    const data = dtStr.length >= 8
      ? `${dtStr.slice(6, 8)}/${dtStr.slice(4, 6)}/${dtStr.slice(0, 4)}`
      : "";

    records.push({
      data,
      descricao,
      valor,
      tipo: classifyType(valor),
      categoria: classifyCategory(descricao),
      documento: get("FITID") || undefined,
      raw: { DTPOSTED: dtStr, TRNAMT: get("TRNAMT"), MEMO: descricao },
    });
  }

  // Also try SGML-style OFX (without closing tags)
  if (records.length === 0) {
    const sgmlBlocks = text.split(/<STMTTRN>/i).slice(1);
    for (const block of sgmlBlocks) {
      const get = (tag: string) => {
        const m = new RegExp(`<${tag}>\\s*(.+)`, "i").exec(block);
        return m ? m[1].trim() : "";
      };

      const valor = parseBRValue(get("TRNAMT"));
      const descricao = get("MEMO") || get("NAME") || "";
      const dtStr = get("DTPOSTED");
      const data = dtStr.length >= 8
        ? `${dtStr.slice(6, 8)}/${dtStr.slice(4, 6)}/${dtStr.slice(0, 4)}`
        : "";

      if (descricao || valor !== 0) {
        records.push({
          data,
          descricao,
          valor,
          tipo: classifyType(valor),
          categoria: classifyCategory(descricao),
          documento: get("FITID") || undefined,
          raw: { DTPOSTED: dtStr, TRNAMT: get("TRNAMT"), MEMO: descricao },
        });
      }
    }
  }

  return records;
}

// ── CNAB 240/400 ────────────────────────────────────────────

export function parseCNAB(text: string): FinancialRecord[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const records: FinancialRecord[] = [];

  for (const line of lines) {
    const len = line.length;

    if (len >= 230 && len <= 250) {
      // CNAB 240
      const segType = line.charAt(13);
      if (segType === "3") {
        const segCode = line.charAt(14);
        if (segCode === "T" || segCode === "U") {
          const valor = parseFloat(line.substring(119, 134).replace(/^0+/, "")) / 100 || 0;
          const descricao = line.substring(133, 173).trim() || `Registro CNAB 240`;
          const rawDate = line.substring(143, 151).trim();
          const data = rawDate.length === 8
            ? `${rawDate.slice(0, 2)}/${rawDate.slice(2, 4)}/${rawDate.slice(4, 8)}`
            : rawDate;

          records.push({
            data,
            descricao,
            valor,
            tipo: classifyType(valor),
            categoria: classifyCategory(descricao),
            raw: { segmento: segCode, linha: line },
          });
        }
      }
    } else if (len >= 390 && len <= 410) {
      // CNAB 400
      const tipo = line.charAt(0);
      if (tipo === "1") {
        const valor = parseFloat(line.substring(152, 165).replace(/^0+/, "")) / 100 || 0;
        const descricao = line.substring(394, 400).trim() || "";
        const rawDate = line.substring(110, 116).trim();
        const data = rawDate.length === 6
          ? `${rawDate.slice(0, 2)}/${rawDate.slice(2, 4)}/${rawDate.slice(4, 6)}`
          : rawDate;

        records.push({
          data,
          descricao: descricao || `Transação CNAB - ${data}`,
          valor,
          tipo: classifyType(valor),
          categoria: classifyCategory(descricao),
          raw: { tipo_registro: tipo, linha: line },
        });
      }
    }
  }
  return records;
}

// ── TXT ─────────────────────────────────────────────────────

export function parseTXT(text: string): FinancialRecord[] {
  const cnabResult = parseCNAB(text);
  if (cnabResult.length > 0) return cnabResult;

  const csvResult = parseCSV(text);
  if (csvResult.length > 0 && csvResult.some((r) => r.data || r.valor !== 0)) {
    return csvResult;
  }

  // Fallback: line-by-line
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.map((line) => ({
    data: "",
    descricao: line.trim(),
    valor: 0,
    tipo: "Neutro",
    categoria: "Outros",
    raw: { line },
  }));
}

// ── Master parser ───────────────────────────────────────────

export async function parseFile(file: File): Promise<FinancialRecord[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    return parseXLSX(buffer);
  }

  const text = await file.text();

  if (ext === "csv") return parseCSV(text);
  if (ext === "ofx") return parseOFX(text);
  if (ext === "txt" || ext === "ret" || ext === "rem") return parseTXT(text);

  // Try generic
  return parseCSV(text);
}
