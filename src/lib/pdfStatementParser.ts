import type { FinancialRecord } from "@/lib/fileParser";

// pdf.js (build ESM) + worker via Vite
import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error - worker importado como URL pelo Vite
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

/** Extrai o texto do PDF preservando quebras de linha por posição vertical. */
export async function extractPdfLines(file: File, password?: string): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
  try {
    pdf = await pdfjsLib.getDocument({ data, password: password || undefined }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    const code = (e as { code?: number })?.code;
    if (name === "PasswordException") {
      // code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      throw new PdfPasswordRequiredError(code === 2);
    }
    throw e;
  }

  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const buckets = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = Math.round(y / 3) * 3; // tolerância vertical
      const arr = buckets.get(key) ?? [];
      arr.push({ x: item.transform[4], s: item.str });
      buckets.set(key, arr);
    }
    const ordered = [...buckets.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, parts] of ordered) {
      const line = parts.sort((a, b) => a.x - b.x).map((t) => t.s).join(" ");
      const clean = line.replace(/\s+/g, " ").trim();
      if (clean) lines.push(clean);
    }
  }
  return lines;
}

function toNumber(br: string): number {
  return parseFloat(br.replace(/\./g, "").replace(",", ".")) || 0;
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

export interface ParsedPdfStatement {
  account: { banco?: string; agencia?: string; conta?: string };
  records: FinancialRecord[];
}

const VALUE = /(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*([CD])?\s*$/i;
const DATE = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/;

/** Converte as linhas de um extrato bancário em PDF para registros financeiros. */
export function parsePdfStatementLines(lines: string[]): ParsedPdfStatement {
  const joined = lines.join("\n");

  const agencia = joined.match(/ag[êe]ncia[:\s]*([\d]{3,6})/i)?.[1]
    ?? joined.match(/\bAg\.?[:\s]*([\d]{3,6})/i)?.[1];
  const conta = joined.match(/conta(?:\s*corrente)?[:\s]*([\d]{3,12}-?[\dxX]?)/i)?.[1]
    ?? joined.match(/\bC\/?C[:\s]*([\d]{3,12}-?[\dxX]?)/i)?.[1];
  const banco = joined.match(/\b(banco[^\n,;]{2,30})/i)?.[1]?.trim();

  // Ano de referência (para linhas com data dd/mm sem ano)
  const yearHint = joined.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear());

  const records: FinancialRecord[] = [];
  for (const line of lines) {
    const dm = line.match(DATE);
    if (!dm) continue;
    const vm = line.match(VALUE);
    if (!vm) continue;

    const yy = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : yearHint;
    const data = `${dm[1]}/${dm[2]}/${yy}`;

    let valor = toNumber(vm[1]);
    const flag = vm[2]?.toUpperCase();
    if (flag === "D" && valor > 0) valor = -valor;
    if (flag === "C" && valor < 0) valor = Math.abs(valor);

    const descricao = line
      .slice(dm[0].length, line.length - vm[0].length)
      .replace(/(-?\d{1,3}(?:\.\d{3})*,\d{2})/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!descricao) continue;

    const tipo = classifyType(valor);
    records.push({
      data,
      lancamento: tipo,
      descricao,
      valor,
      tipo,
      tipoLancamento: valor >= 0 ? "CREDIT" : "DEBIT",
      categoria: classifyCategory(descricao),
      documento: undefined,
      codigoOperacao: undefined,
      fitid: `PDF|${data}|${valor}|${descricao}`.slice(0, 120),
      raw: { linha: line, origem: "PDF" },
    });
  }

  return {
    account: {
      banco: banco || undefined,
      agencia: agencia?.replace(/\D/g, "") || undefined,
      conta: conta?.trim() || undefined,
    },
    records,
  };
}

export async function parsePdfStatement(file: File, password?: string): Promise<ParsedPdfStatement> {
  const lines = await extractPdfLines(file, password);
  return parsePdfStatementLines(lines);
}
