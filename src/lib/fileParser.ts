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

// Normalize column name for matching
function normalize(col: string): string {
  return col
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

function rowsToRecords(rows: Record<string, unknown>[]): FinancialRecord[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);

  const dateCol = detectColumn(headers, ["data", "date", "dt", "lancamento", "lançamento"]);
  const descCol = detectColumn(headers, ["descricao", "descrição", "historico", "histórico", "memo", "detail", "description"]);
  const valueCol = detectColumn(headers, ["valor", "value", "amount", "quantia", "vlr", "montante"]);
  const docCol = detectColumn(headers, ["documento", "doc", "nrdoc", "numero"]);

  return rows
    .map((row) => {
      const rawValor = valueCol ? row[valueCol] : 0;
      const valor = typeof rawValor === "number" ? rawValor : parseFloat(String(rawValor).replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      const descricao = descCol ? String(row[descCol] ?? "") : JSON.stringify(row);

      return {
        data: dateCol ? String(row[dateCol] ?? "") : "",
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

// Parse XLSX/XLS
export function parseXLSX(buffer: ArrayBuffer): FinancialRecord[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const allRecords: FinancialRecord[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);
    allRecords.push(...rowsToRecords(rows));
  }
  return allRecords;
}

// Detect best delimiter for CSV/TXT
function detectDelimiter(text: string): string {
  const firstLines = text.split("\n").slice(0, 5).join("\n");
  const delimiters = [";", "\t", ",", "|"];
  let best = ",";
  let maxCount = 0;
  for (const d of delimiters) {
    const count = (firstLines.match(new RegExp(d === "\t" ? "\\t" : "\\" + d, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      best = d;
    }
  }
  return best;
}

// Parse CSV
export function parseCSV(text: string): FinancialRecord[] {
  const delimiter = detectDelimiter(text);
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimiter,
  });
  return rowsToRecords(result.data);
}

// Parse OFX (simplified)
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
    const data = dtStr ? `${dtStr.slice(6, 8)}/${dtStr.slice(4, 6)}/${dtStr.slice(0, 4)}` : "";

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

// Parse CNAB 240/400
export function parseCNAB(text: string): FinancialRecord[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const records: FinancialRecord[] = [];

  for (const line of lines) {
    if (line.length === 240) {
      // CNAB 240 - Segment T/U
      const segType = line.charAt(13);
      if (segType === "3") {
        const segCode = line.charAt(13 + 1);
        if (segCode === "T" || segCode === "U") {
          const valor = parseFloat(line.substring(119, 134).replace(/^0+/, "")) / 100 || 0;
          const descricao = line.substring(133, 173).trim() || `Registro CNAB 240`;
          const data = line.substring(143, 151).trim();

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
    } else if (line.length === 400) {
      // CNAB 400 - Type 1 detail
      const tipo = line.charAt(0);
      if (tipo === "1") {
        const valor = parseFloat(line.substring(152, 165).replace(/^0+/, "")) / 100 || 0;
        const descricao = line.substring(394, 400).trim() || `Registro CNAB 400`;
        const data = line.substring(110, 116).trim();

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

// Parse TXT (try structured formats first, then line-by-line)
export function parseTXT(text: string): FinancialRecord[] {
  // Try CNAB first (fixed-width lines of 240 or 400 chars)
  const cnabResult = parseCNAB(text);
  if (cnabResult.length > 0) return cnabResult;

  // Try as delimited file (CSV/TSV/semicolon) with header detection
  const csvResult = parseCSV(text);
  if (csvResult.length > 0 && csvResult.some((r) => r.data || r.valor !== 0)) {
    return csvResult;
  }

  // Fallback: line-by-line (no structured data found)
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

// Master parser
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
