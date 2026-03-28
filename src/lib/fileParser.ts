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

// --- Helpers ---

function normalize(col: string): string {
  return col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function detectColumn(headers: string[], keywords: string[]): string | null {
  for (const h of headers) {
    const n = normalize(h);
    if (keywords.some((k) => n.includes(k))) return h;
  }
  return null;
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
  if (d.includes("salario") || d.includes("salário") || d.includes("pagamento")) return "Pagamento";
  if (d.includes("saque")) return "Saque";
  if (d.includes("deposito") || d.includes("depósito")) return "Depósito";
  if (d.includes("compra") || d.includes("debito automatico")) return "Compra";
  if (d.includes("juros") || d.includes("rendimento")) return "Rendimento";
  if (d.includes("estorno")) return "Estorno";
  return "Outros";
}

function parseBRValue(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  // Remove currency symbols and spaces
  let clean = s.replace(/[R$\s]/g, "");
  // Brazilian format: 1.234,56 → 1234.56
  if (clean.includes(",")) {
    // If has both dot and comma, dots are thousands separators
    clean = clean.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(clean) || 0;
}

// --- Normalize text encoding & line endings ---

function normalizeText(text: string): string {
  // Remove BOM
  let t = text.replace(/^\uFEFF/, "");
  // Normalize line endings: \r\n → \n, lone \r → \n
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return t;
}

function splitLines(text: string): string[] {
  return normalizeText(text).split("\n").filter((l) => l.trim().length > 0);
}

// --- Detect CSV delimiter ---

function detectDelimiter(sample: string): string {
  const delimiters = [";", ",", "\t", "|"];
  const lines = sample.split("\n").filter((l) => l.trim()).slice(0, 10);
  if (lines.length === 0) return ",";

  let bestDelim = ",";
  let bestScore = -1;

  for (const d of delimiters) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const first = counts[0];
    // A good delimiter produces consistent column counts > 0
    if (first > 0 && counts.every((c) => c === first)) {
      if (first > bestScore) {
        bestScore = first;
        bestDelim = d;
      }
    }
  }

  // Fallback: pick delimiter with highest average count
  if (bestScore <= 0) {
    for (const d of delimiters) {
      const avg = lines.reduce((sum, l) => sum + (l.split(d).length - 1), 0) / lines.length;
      if (avg > bestScore) {
        bestScore = avg;
        bestDelim = d;
      }
    }
  }

  return bestDelim;
}

// --- Row mapping ---

function rowsToRecords(rows: Record<string, unknown>[]): FinancialRecord[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);

  const dateCol = detectColumn(headers, ["data", "date", "dt", "lancamento", "lançamento", "dtmov", "dt_mov"]);
  const descCol = detectColumn(headers, ["descricao", "descrição", "historico", "histórico", "memo", "detail", "description", "complemento"]);
  const valueCol = detectColumn(headers, ["valor", "value", "amount", "quantia", "vlr", "montante"]);
  const creditCol = detectColumn(headers, ["credito", "crédito", "credit"]);
  const debitCol = detectColumn(headers, ["debito", "débito", "debit"]);
  const docCol = detectColumn(headers, ["documento", "doc", "nrdoc", "numero"]);

  return rows
    .map((row) => {
      let valor: number;

      if (valueCol) {
        valor = parseBRValue(row[valueCol]);
      } else if (creditCol || debitCol) {
        const credit = creditCol ? parseBRValue(row[creditCol]) : 0;
        const debit = debitCol ? Math.abs(parseBRValue(row[debitCol])) : 0;
        valor = credit > 0 ? credit : -debit;
      } else {
        valor = 0;
      }

      const descricao = descCol ? String(row[descCol] ?? "").trim() : JSON.stringify(row);

      return {
        data: dateCol ? String(row[dateCol] ?? "").trim() : "",
        descricao,
        valor,
        tipo: classifyType(valor),
        categoria: classifyCategory(descricao),
        documento: docCol ? String(row[docCol] ?? "") : undefined,
        raw: row as Record<string, unknown>,
      };
    })
    .filter((r) => r.descricao || r.valor !== 0);
}

// --- Parsers ---

export function parseXLSX(buffer: ArrayBuffer): FinancialRecord[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const allRecords: FinancialRecord[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);
    allRecords.push(...rowsToRecords(rows));
  }
  return allRecords;
}

export function parseCSV(text: string): FinancialRecord[] {
  const normalized = normalizeText(text);
  const delimiter = detectDelimiter(normalized);

  const result = Papa.parse<Record<string, unknown>>(normalized, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // keep as strings to handle BR number format
    delimiter,
  });

  return rowsToRecords(result.data);
}

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

    const valor = parseFloat(get("TRNAMT").replace(",", ".")) || 0;
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
  return records;
}

export function parseCNAB(text: string): FinancialRecord[] {
  const lines = splitLines(text);
  const records: FinancialRecord[] = [];

  for (const line of lines) {
    const len = line.length;

    if (len >= 240 && len <= 250) {
      // CNAB 240
      const segType = line.charAt(13);
      if (segType === "3") {
        const segCode = line.charAt(14);
        if (segCode === "T" || segCode === "U") {
          const valor = parseFloat(line.substring(119, 134).replace(/^0+/, "")) / 100 || 0;
          const descricao = line.substring(133, 173).trim() || `Registro CNAB 240 - Seg ${segCode}`;
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
    } else if (len >= 400 && len <= 410) {
      // CNAB 400
      const tipo = line.charAt(0);
      if (tipo === "1") {
        const valor = parseFloat(line.substring(152, 165).replace(/^0+/, "")) / 100 || 0;
        const rawDate = line.substring(110, 116).trim();
        const data = rawDate.length === 6
          ? `${rawDate.slice(0, 2)}/${rawDate.slice(2, 4)}/${rawDate.slice(4, 6)}`
          : rawDate;
        const descricao = line.substring(316, 391).trim() || `Transação CNAB 400`;

        records.push({
          data,
          descricao,
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

export function parseTXT(text: string): FinancialRecord[] {
  const normalized = normalizeText(text);
  const lines = normalized.split("\n").filter((l) => l.trim());

  // Check if it looks like CNAB (fixed-width lines)
  const nonEmptyLines = lines.slice(0, 5);
  const avgLen = nonEmptyLines.reduce((s, l) => s + l.length, 0) / nonEmptyLines.length;
  if (avgLen >= 230 && nonEmptyLines.every((l) => Math.abs(l.length - avgLen) < 15)) {
    const cnabResult = parseCNAB(normalized);
    if (cnabResult.length > 0) return cnabResult;
  }

  // Check if it looks like delimited data (CSV/TSV)
  const hasDelimiters = lines.some((l) => /[;\t,|]/.test(l));
  if (hasDelimiters) {
    const csvResult = parseCSV(normalized);
    if (csvResult.length > 0) return csvResult;
  }

  // Check for tab-separated or multi-space-separated data
  const firstLine = lines[0];
  const isTabbed = firstLine.includes("\t");
  const isMultiSpace = /\s{2,}/.test(firstLine);

  if (isTabbed || isMultiSpace) {
    const splitPattern = isTabbed ? /\t+/ : /\s{2,}/;
    const headerCells = firstLine.split(splitPattern).map((c) => c.trim()).filter(Boolean);

    if (headerCells.length >= 2) {
      const rows: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(splitPattern).map((c) => c.trim());
        const row: Record<string, unknown> = {};
        headerCells.forEach((h, idx) => {
          row[h] = cells[idx] ?? "";
        });
        rows.push(row);
      }
      const records = rowsToRecords(rows);
      if (records.length > 0) return records;
    }
  }

  // Fallback: line-by-line
  return lines.map((line) => ({
    data: "",
    descricao: line.trim(),
    valor: 0,
    tipo: "Neutro",
    categoria: "Outros",
    raw: { line },
  }));
}

// --- Master parser ---

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

  // Fallback
  return parseCSV(text);
}
