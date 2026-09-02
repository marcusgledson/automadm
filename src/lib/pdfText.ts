/**
 * Utilitários de leitura de PDF no navegador (pdf.js), com suporte a senha.
 * Usado pela Central de Contas e pela importação do Google Drive.
 */
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker as string;

export type PdfPasswordState =
  | "ok"            // abriu sem senha ou com a senha informada
  | "required"      // exige senha e nenhuma foi informada
  | "wrong"         // senha informada está incorreta
  | "invalid";      // não é um PDF legível

export interface PdfCheckResult {
  state: PdfPasswordState;
  numPages?: number;
  /** Dica de senha declarada pelo emissor, quando presente nos metadados. */
  hint?: string;
  error?: string;
}

function classify(e: unknown): PdfCheckResult {
  const name = (e as { name?: string })?.name;
  const code = (e as { code?: number })?.code;
  const msg = e instanceof Error ? e.message : String(e);
  if (name === "PasswordException") {
    return { state: code === 2 ? "wrong" : "required" };
  }
  if (/password/i.test(msg)) return { state: "required" };
  return { state: "invalid", error: msg };
}

/** Procura uma dica de senha nos metadados do PDF (Keywords/Subject/Title). */
async function readHint(doc: pdfjsLib.PDFDocumentProxy): Promise<string | undefined> {
  try {
    const meta = await doc.getMetadata();
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    const candidates = [info.Keywords, info.Subject, info.Title]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v && /senha|password|cpf|cnpj/i.test(v));
    return candidates[0] || undefined;
  } catch {
    return undefined;
  }
}

/** Verifica se o PDF abre com a senha informada. Nunca lança. */
export async function checkPdfPassword(
  data: ArrayBuffer | Uint8Array,
  password?: string,
): Promise<PdfCheckResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  try {
    const doc = await pdfjsLib.getDocument({
      data: bytes.slice(0),
      password: password || undefined,
    }).promise;
    const hint = await readHint(doc);
    const numPages = doc.numPages;
    void doc.destroy();
    return { state: "ok", numPages, hint };
  } catch (e) {
    return classify(e);
  }
}

/** Extrai o texto do PDF preservando quebras de linha aproximadas. */
export async function extractPdfPlainText(
  data: ArrayBuffer | Uint8Array,
  password?: string,
): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await pdfjsLib.getDocument({
    data: bytes.slice(0),
    password: password || undefined,
  }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = item.str ?? "";
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        parts.push(line.trim());
        line = "";
      }
      line += (line && !line.endsWith(" ") ? " " : "") + str;
      lastY = y;
    }
    if (line.trim()) parts.push(line.trim());
  }
  void doc.destroy();
  return parts.filter(Boolean).join("\n");
}
