import type { FinancialRecord } from "@/lib/fileParser";
import { detectBankFromText, type BankDetection } from "@/lib/bankDetect";
import { extractHolder, type HolderInfo } from "@/lib/accountHolder";

// pdf.js (build ESM) + worker via Vite
import * as pdfjsLib from "pdfjs-dist";
// worker importado como URL pelo Vite
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker as string;

export class PdfPasswordRequiredError extends Error {
  constructor(public wrongPassword = false) {
    super(
      wrongPassword
        ? "Senha do PDF incorreta."
        : "Este PDF está protegido por senha.",
    );
    this.name = "PdfPasswordRequiredError";
  }
}

/** Célula de texto com posição horizontal. */
export interface PdfCell {
  x: number;
  width: number;
  text: string;
}

/** Linha física do PDF, com suas células ordenadas por x. */
export interface PdfLine {
  page: number;
  y: number;
  cells: PdfCell[];
  text: string;
}

async function loadDocument(file: File, password?: string) {
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    return await pdfjsLib.getDocument({ data, password: password || undefined }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    const code = (e as { code?: number })?.code;
    if (name === "PasswordException") {
      // code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      throw new PdfPasswordRequiredError(code === 2);
    }
    throw e;
  }
}

/** Extrai as linhas do PDF preservando as coordenadas de cada célula. */
export async function extractPdfLayout(file: File, password?: string): Promise<PdfLine[]> {
  const pdf = await loadDocument(file, password);
  const out: PdfLine[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const buckets = new Map<number, PdfCell[]>();
    for (const item of content.items as { str: string; transform: number[]; width?: number }[]) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = Math.round(y / 3) * 3; // tolerância vertical
      const arr = buckets.get(key) ?? [];
      arr.push({ x: item.transform[4], width: item.width ?? item.str.length * 4, text: item.str.trim() });
      buckets.set(key, arr);
    }
    const ordered = [...buckets.entries()].sort((a, b) => b[0] - a[0]);
    for (const [y, cells] of ordered) {
      const sorted = cells.sort((a, b) => a.x - b.x);
      const text = sorted.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim();
      if (text) out.push({ page: p, y, cells: sorted, text });
    }
  }
  return out;
}

/** Compatibilidade: apenas o texto das linhas. */
export async function extractPdfLines(file: File, password?: string): Promise<string[]> {
  const layout = await extractPdfLayout(file, password);
  return layout.map((l) => l.text);
}

function toNumber(br: string): number {
  const t = br.replace(/R\$/gi, "").trim();
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-") || /-\s*$/.test(t);
  const n =
    parseFloat(t.replace(/[()\s-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  return neg ? -Math.abs(n) : n;
}

function classifyType(v: number) {
  return v > 0 ? "Crédito" : v < 0 ? "Débito" : "Neutro";
}

function classifyCategory(descricao: string): string {
  const d = descricao.toLowerCase();
  if (d.includes("saldo")) return "Saldo do Dia";
  if (d.includes("pix")) return "PIX";
  if (d.includes("ted") || d.includes("doc")) return "Transferência";
  if (d.includes("boleto")) return "Boleto";
  if (d.includes("tarifa") || d.includes("taxa") || d.includes("iof")) return "Tarifa";
  if (d.includes("salario") || d.includes("salário") || d.includes("pagamento")) return "Pagamento";
  if (d.includes("saque")) return "Saque";
  if (d.includes("deposito") || d.includes("depósito")) return "Depósito";
  if (d.includes("compra") || d.includes("débito automático")) return "Compra";
  if (d.includes("juros") || d.includes("rendimento")) return "Rendimento";
  if (d.includes("estorno")) return "Estorno";
  return "Outros";
}

export type ColumnField =
  | "data"
  | "descricao"
  | "documento"
  | "valor"
  | "debito"
  | "credito"
  | "saldo"
  | "tipo"
  | "categoria"
  | "ignorar";

export interface DetectedColumn {
  /** Rótulo original do cabeçalho. */
  label: string;
  /** Campo mapeado do registro. */
  field: ColumnField;
  /** Faixa horizontal (x inicial e final) da coluna. */
  start: number;
  end: number;
}

/** Informações de diagnóstico para explicar leituras vazias. */
export interface PdfDiagnostics {
  pages: number;
  linhas: number;
  temTexto: boolean;
  cabecalhoDetectado: boolean;
  /** Motivo provável quando nenhum lançamento é reconhecido. */
  motivo?: string;
  /** Primeiras linhas extraídas, para inspeção do usuário. */
  amostra: string[];
}

export interface ParsedPdfStatement {
  account: { banco?: string; agencia?: string; conta?: string };
  bank?: BankDetection;
  holder: HolderInfo;
  records: FinancialRecord[];
  /** Colunas reconhecidas quando o extrato tem cabeçalho tabular. */
  columns?: DetectedColumn[];
  /** Índice da linha de cabeçalho (para reprocessar com colunas corrigidas). */
  headerIndex?: number;
  /** Layout bruto do PDF, permitindo reprocessamento sem reabrir o arquivo. */
  lines: PdfLine[];
  /** Estratégia utilizada na leitura. */
  strategy: "colunas" | "linhas" | "blocos";
  /** Texto completo (para detecções adicionais). */
  text: string;
  diagnostics: PdfDiagnostics;
}


const VALUE_ANY = /(-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?|-?\(?\d+,\d{2}\)?-?)/;
const VALUE_GLOBAL = /(-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?|-?\(?\d+,\d{2}\)?-?)/g;
const VALUE_END = /(-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?|-?\(?\d+,\d{2}\)?-?)\s*([CD])?\s*$/i;
const DATE = /^(\d{2})[/.-](\d{2})(?:[/.-](\d{2,4}))?\b/;
const DATE_ANY = /\b(\d{2})[/.-](\d{2})(?:[/.-](\d{2,4}))?\b/;

const HEADER_MAP: { re: RegExp; field: ColumnField }[] = [
  { re: /^data(\s*(mov|movimenta[cç][aã]o|lan[cç]amento))?\.?$/i, field: "data" },
  { re: /^dt\.?$/i, field: "data" },
  { re: /^(hist[oó]rico|descri[cç][aã]o|lan[cç]amento|movimenta[cç][aã]o|detalhe|opera[cç][aã]o)$/i, field: "descricao" },
  { re: /^(documento|n[º°o]?\.?\s*doc\.?|doc\.?|n[uú]mero)$/i, field: "documento" },
  { re: /^(d[eé]bito|saida|sa[ií]da|d[eé]b\.?)$/i, field: "debito" },
  { re: /^(cr[eé]dito|entrada|cr[eé]d\.?)$/i, field: "credito" },
  { re: /^(valor|valor\s*\(r\$\)|vlr\.?|montante)$/i, field: "valor" },
  { re: /^saldo(\s*\(r\$\))?$/i, field: "saldo" },
  { re: /^tipo$/i, field: "tipo" },
  { re: /^categoria$/i, field: "categoria" },
];

function labelToField(label: string): ColumnField | undefined {
  const clean = label.replace(/\s+/g, " ").trim();
  for (const h of HEADER_MAP) if (h.re.test(clean)) return h.field;
  return undefined;
}

const SKIP_LINE =
  /(saldo\s+anterior|saldo\s+final|total\s+(geral|do|de)|p[aá]gina\s+\d|continua(ç|c)?[aã]o|extrato\s+de\s+conta)/i;

/** Rótulos compostos usados na varredura dentro de uma célula única. */
const INLINE_LABELS: { re: RegExp; field: ColumnField }[] = [
  { re: /data\s*(?:mov\.?|movimenta[cç][aã]o|lan[cç]amento)?/gi, field: "data" },
  { re: /hist[oó]rico|descri[cç][aã]o|lan[cç]amentos?|movimenta[cç][aã]o|detalhe/gi, field: "descricao" },
  { re: /documento|n[º°o]?\.?\s*doc\.?|doc\.?/gi, field: "documento" },
  { re: /d[eé]bito|sa[ií]da/gi, field: "debito" },
  { re: /cr[eé]dito|entrada/gi, field: "credito" },
  { re: /valor(?:\s*\(?r\$\)?)?|vlr\.?/gi, field: "valor" },
  { re: /saldo(?:\s*\(?r\$\)?)?/gi, field: "saldo" },
];

/** Converte as células de uma linha em possíveis rótulos de coluna (com x estimado). */
function headerCandidates(cells: PdfCell[]): { cell: PdfCell; field: ColumnField }[] {
  const out: { cell: PdfCell; field: ColumnField }[] = [];
  for (const cell of cells) {
    const direct = labelToField(cell.text);
    if (direct) {
      out.push({ cell, field: direct });
      continue;
    }
    // Célula única contendo vários rótulos ("Data Histórico Valor Saldo")
    const len = Math.max(cell.text.length, 1);
    const found: { cell: PdfCell; field: ColumnField }[] = [];
    for (const { re, field } of INLINE_LABELS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cell.text)) !== null) {
        const x = cell.x + (cell.width * m.index) / len;
        const width = (cell.width * m[0].length) / len;
        found.push({ cell: { x, width, text: m[0] }, field });
      }
    }
    if (found.length >= 2) out.push(...found);
  }
  // Remove rótulos duplicados do mesmo campo mantendo o primeiro (menor x)
  const seen = new Set<ColumnField>();
  return out
    .sort((a, b) => a.cell.x - b.cell.x)
    .filter((m) => (seen.has(m.field) ? false : (seen.add(m.field), true)));
}

/** Detecta a linha de cabeçalho da tabela e monta as faixas de coluna. */
export function detectColumns(lines: PdfLine[]): { columns: DetectedColumn[]; headerIndex: number } | undefined {
  const limit = Math.min(lines.length, 200);
  for (let i = 0; i < limit; i++) {
    // Considera a linha isolada e, em seguida, junto da seguinte (cabeçalho em 2 linhas)
    const attempts: { cells: PdfCell[]; index: number }[] = [{ cells: lines[i].cells, index: i }];
    if (i + 1 < limit) {
      attempts.push({ cells: [...lines[i].cells, ...lines[i + 1].cells], index: i + 1 });
    }

    for (const attempt of attempts) {
      const mapped = headerCandidates(attempt.cells);
      const fields = new Set(mapped.map((m) => m.field));
      const hasValue = fields.has("valor") || fields.has("debito") || fields.has("credito");
      if (!(fields.has("data") && hasValue && mapped.length >= 3)) continue;

      const sorted = mapped.sort((a, b) => a.cell.x - b.cell.x);
      const columns: DetectedColumn[] = sorted.map((m, idx) => {
        const start = idx === 0 ? -Infinity : (sorted[idx - 1].cell.x + sorted[idx - 1].cell.width + m.cell.x) / 2;
        const end =
          idx === sorted.length - 1
            ? Infinity
            : (m.cell.x + m.cell.width + sorted[idx + 1].cell.x) / 2;
        return { label: m.cell.text, field: m.field, start, end };
      });
      return { columns, headerIndex: attempt.index };
    }
  }
  return undefined;
}

function cellsToColumns(line: PdfLine, columns: DetectedColumn[]): string[] {
  const buckets = columns.map(() => [] as string[]);
  for (const cell of line.cells) {
    const center = cell.x + cell.width / 2;
    let idx = columns.findIndex((c) => center >= c.start && center < c.end);
    if (idx < 0) idx = center < columns[0].end ? 0 : columns.length - 1;
    buckets[idx].push(cell.text);
  }
  return buckets.map((b) => b.join(" ").replace(/\s+/g, " ").trim());
}

function buildRecord(
  data: string,
  descricao: string,
  valor: number,
  documento: string | undefined,
  tipoLabel: string | undefined,
  categoria: string | undefined,
  rawLine: string,
): FinancialRecord {
  const tipo = classifyType(valor);
  return {
    data,
    lancamento: tipoLabel || tipo,
    descricao,
    valor,
    tipo,
    tipoLancamento: valor >= 0 ? "CREDIT" : "DEBIT",
    categoria: categoria || classifyCategory(descricao),
    documento: documento || undefined,
    codigoOperacao: undefined,
    fitid: `PDF|${data}|${valor}|${descricao}`.slice(0, 120),
    raw: { linha: rawLine, origem: "PDF" },
  };
}

function yearHintOf(text: string) {
  return text.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear());
}

/** Meses abreviados usados em extratos com data por bloco (ex.: Nubank "04 JAN 2022"). */
const MONTHS: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

const BLOCK_DATE = /^(\d{1,2})\s+([A-Za-zçÇ]{3})[A-Za-zçÇ.]*\s+(\d{4})\b/;
const BLOCK_SKIP =
  /^(saldo\s+(do\s+dia|inicial|final)|rendimento|total\s+de\s+(entradas|sa[ií]das)|movimenta[cç][õo]es|valores\s+em|tem\s+alguma\s+d[úu]vida|atendimento|cnpj|cpf\b)/i;

/**
 * Extratos sem cabeçalho tabular, com a data no início de cada bloco e as
 * seções "Total de entradas" / "Total de saídas" definindo o sinal (padrão Nubank).
 */
function parseByBlocks(textLines: string[]): FinancialRecord[] {
  const records: FinancialRecord[] = [];
  let data: string | undefined;
  let sign: 1 | -1 | undefined;

  for (const rawLine of textLines) {
    let line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const bd = line.match(BLOCK_DATE);
    if (bd) {
      const mm = MONTHS[bd[2].toLowerCase()];
      if (mm) {
        data = `${bd[1].padStart(2, "0")}/${mm}/${bd[3]}`;
        sign = undefined;
        line = line.slice(bd[0].length).trim();
        if (!line) continue;
      }
    }

    if (/^total\s+de\s+entradas/i.test(line)) { sign = 1; continue; }
    if (/^total\s+de\s+sa[ií]das/i.test(line)) { sign = -1; continue; }
    if (BLOCK_SKIP.test(line)) continue;
    if (!data) continue;

    const vm = line.match(VALUE_END);
    if (!vm) {
      // Linha de continuação: complementa a descrição do último lançamento.
      const last = records[records.length - 1];
      if (last && line.length <= 120 && last.descricao.length < 240) {
        last.descricao = `${last.descricao} ${line}`.replace(/\s+/g, " ").trim();
      }
      continue;
    }

    const descricao = line.slice(0, line.length - vm[0].length).replace(/[+-]\s*$/, "").trim();
    if (!descricao) continue;

    const abs = Math.abs(toNumber(vm[1]));
    const valor = (sign ?? 1) * abs;
    records.push(buildRecord(data, descricao, valor, undefined, undefined, undefined, rawLine));
  }

  return records;
}

function normalizeDate(dm: RegExpMatchArray, yearHint: string) {
  const yy = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : yearHint;
  return `${dm[1]}/${dm[2]}/${yy}`;
}

/** Leitura com consciência de colunas (usa o cabeçalho detectado). */
function parseByColumns(lines: PdfLine[], columns: DetectedColumn[], headerIndex: number, yearHint: string) {
  const records: FinancialRecord[] = [];
  let lastDate: string | undefined;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_LINE.test(line.text)) continue;
    // Cabeçalho repetido em outra página
    if (labelToField(line.cells[0]?.text ?? "") === "data" && line.cells.length >= 3) continue;

    const cols = cellsToColumns(line, columns);
    const get = (field: ColumnField) => {
      const idx = columns.findIndex((c) => c.field === field);
      return idx >= 0 ? cols[idx] : "";
    };

    const dataRaw = get("data");
    const dm = dataRaw.match(DATE) ?? dataRaw.match(DATE_ANY) ?? line.text.match(DATE);
    const descricao = [get("descricao")].filter(Boolean).join(" ").trim();
    const hasValue = VALUE_ANY.test(line.text);

    let data: string | undefined;
    if (dm) {
      data = normalizeDate(dm, yearHint);
      lastDate = data;
    } else if (hasValue && lastDate) {
      // Extrato com data por bloco: herda a data do lançamento anterior
      data = lastDate;
    } else {
      // Continuação da descrição do lançamento anterior
      if (descricao && records.length > 0) {
        const prev = records[records.length - 1];
        prev.descricao = `${prev.descricao} ${descricao}`.replace(/\s+/g, " ").trim();
      }
      continue;
    }

    const debito = get("debito");
    const credito = get("credito");
    const valorCol = get("valor");

    let valor = 0;
    if (debito || credito) {
      const d = debito.match(VALUE_ANY)?.[1];
      const c = credito.match(VALUE_ANY)?.[1];
      if (d) valor = -Math.abs(toNumber(d));
      else if (c) valor = Math.abs(toNumber(c));
    } else {
      const vm = valorCol.match(VALUE_END) ?? valorCol.match(VALUE_ANY);
      if (!vm) continue;
      valor = toNumber(vm[1]);
      const flag = (valorCol.match(/\b([CD])\b\s*$/i)?.[1] ?? "").toUpperCase();
      if (flag === "D") valor = -Math.abs(valor);
      if (flag === "C") valor = Math.abs(valor);
    }
    if (!valor && !descricao) continue;

    records.push(
      buildRecord(
        data,
        descricao || "Lançamento",
        valor,
        get("documento") || undefined,
        get("tipo") || undefined,
        get("categoria") || undefined,
        line.text,
      ),
    );
  }
  return records;
}

/** Leitura genérica linha a linha (fallback). */
function parseByLines(lines: string[], yearHint: string) {
  const records: FinancialRecord[] = [];
  let lastDate: string | undefined;

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;

    const dm = line.match(DATE) ?? line.match(DATE_ANY);
    const values = line.match(VALUE_GLOBAL) ?? [];
    if (values.length === 0) continue;

    let data: string | undefined;
    if (dm) {
      data = normalizeDate(dm, yearHint);
      lastDate = data;
    } else if (lastDate) {
      data = lastDate; // extrato com data por bloco
    } else {
      continue;
    }

    // Quando há dois ou mais números, o último costuma ser o saldo acumulado.
    const raw = values.length >= 2 ? values[values.length - 2] : values[values.length - 1];
    let valor = toNumber(raw);

    const flag = (line.match(/\b([CD])\b\s*$/i)?.[1] ?? "").toUpperCase();
    if (flag === "D") valor = -Math.abs(valor);
    if (flag === "C") valor = Math.abs(valor);
    if (/\bd[eé]bito\b/i.test(line)) valor = -Math.abs(valor);

    const descricao = line
      .replace(dm ? dm[0] : "", " ")
      .replace(VALUE_GLOBAL, " ")
      .replace(/\bR\$\b/gi, " ")
      .replace(/\b[CD]\b\s*$/i, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!descricao) continue;

    records.push(buildRecord(data, descricao, valor, undefined, undefined, undefined, line));
  }
  return records;
}

/** Converte as linhas (com layout) de um extrato em PDF para registros financeiros. */
export function parsePdfStatementLayout(lines: PdfLine[]): ParsedPdfStatement {
  const text = lines.map((l) => l.text).join("\n");
  const textLines = lines.map((l) => l.text);

  const agencia = text.match(/ag[êe]ncia[:\s]*([\d]{3,6})/i)?.[1]
    ?? text.match(/\bAg\.?[:\s]*([\d]{3,6})/i)?.[1];
  const conta = text.match(/conta(?:\s*corrente)?[:\s]*([\d]{3,12}-[\dxX])/i)?.[1]
    ?? text.match(/conta(?:\s*corrente)?[:\s]*([\d]{3,12}-?[\dxX]?)/i)?.[1]
    // Nubank e similares quebram a linha entre o rótulo "Conta" e o número.
    ?? text.match(/conta(?:\s*corrente)?\s*[:\s]*\n\s*([\d]{5,12}-[\dxX])/i)?.[1]
    ?? text.match(/\bC\/?C[:\s]*([\d]{3,12}-?[\dxX]?)/i)?.[1];

  const bank = detectBankFromText(text);
  const holder = extractHolder(textLines);
  const yearHint = yearHintOf(text);

  const detected = detectColumns(lines);
  let records: FinancialRecord[] = [];
  let strategy: "colunas" | "linhas" | "blocos" = "linhas";
  if (detected) {
    records = parseByColumns(lines, detected.columns, detected.headerIndex, yearHint);
    strategy = "colunas";
  }
  if (records.length === 0) {
    records = parseByBlocks(textLines);
    strategy = "blocos";
  }
  if (records.length === 0) {
    records = parseByLines(textLines, yearHint);
    strategy = "linhas";
  }

  const pages = lines.length ? Math.max(...lines.map((l) => l.page)) : 0;
  const diagnostics: PdfDiagnostics = {
    pages,
    linhas: lines.length,
    temTexto: textLines.some((t) => t.trim().length > 0),
    cabecalhoDetectado: !!detected,
    amostra: textLines.slice(0, 30),
    motivo:
      records.length > 0
        ? undefined
        : !textLines.some((t) => t.trim().length > 0)
          ? "O PDF não possui camada de texto (provavelmente digitalizado/imagem). É necessário um arquivo com texto selecionável."
          : !detected
            ? "Não foi possível reconhecer o cabeçalho da tabela nem lançamentos no formato data + valor."
            : "O cabeçalho foi reconhecido, mas nenhuma linha de lançamento pôde ser interpretada.",
  };



  return {
    account: {
      banco: bank?.name ?? text.match(/\b(banco[^\n,;]{2,30})/i)?.[1]?.trim() ?? undefined,
      agencia: agencia?.replace(/\D/g, "") || undefined,
      conta: conta?.trim() || undefined,
    },
    bank,
    holder,
    records,
    columns: detected?.columns,
    headerIndex: detected?.headerIndex,
    lines,
    strategy,
    text,
    diagnostics,
  };
}

/**
 * Reprocessa os lançamentos usando um mapeamento de colunas corrigido pelo usuário.
 * Colunas marcadas como "ignorar" são descartadas.
 */
export function reparseWithColumns(
  lines: PdfLine[],
  columns: DetectedColumn[],
  headerIndex: number,
): FinancialRecord[] {
  const usable = columns.filter((c) => c.field !== "ignorar");
  if (usable.length === 0) return [];
  const yearHint = yearHintOf(lines.map((l) => l.text).join("\n"));
  return parseByColumns(lines, usable, headerIndex, yearHint);
}


/** Compatibilidade: parser a partir de linhas de texto puras. */
export function parsePdfStatementLines(textLines: string[]): ParsedPdfStatement {
  const lines: PdfLine[] = textLines.map((t, i) => ({
    page: 1,
    y: -i,
    cells: [{ x: 0, width: t.length * 4, text: t }],
    text: t,
  }));
  return parsePdfStatementLayout(lines);
}

export async function parsePdfStatement(file: File, password?: string): Promise<ParsedPdfStatement> {
  const layout = await extractPdfLayout(file, password);
  return parsePdfStatementLayout(layout);
}

/** Renderiza a faixa superior da 1ª página em PNG (base64) para identificação da logo. */
export async function renderHeaderImage(file: File, password?: string): Promise<string> {
  const pdf = await loadDocument(file, password);
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.2 });
  const cropHeight = Math.min(viewport.height, Math.round(viewport.height * 0.22));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(0, -(viewport.height - cropHeight));
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}
