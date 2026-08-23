/**
 * Validação de arquivos e rate limiting local para o uploader de extratos.
 * Objetivo: reduzir abuso e evitar processamento excessivo de PDFs grandes.
 */

export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_OFX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Janela de rate limiting local */
export const RATE_LIMIT_MAX = 10; // arquivos
export const RATE_LIMIT_WINDOW_MS = 60_000; // por minuto
export const MIN_INTERVAL_MS = 1_500; // intervalo mínimo entre arquivos

export type UploadKind = "ofx" | "pdf";

export interface ValidationResult {
  ok: boolean;
  kind?: UploadKind;
  error?: string;
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/** Valida extensão, tipo MIME e tamanho. */
export function validateStatementFile(file: File): ValidationResult {
  const ext = extensionOf(file.name);

  if (ext !== ".pdf" && ext !== ".ofx") {
    return { ok: false, error: "Formato não suportado. Envie um arquivo .OFX ou .PDF." };
  }

  if (file.size === 0) {
    return { ok: false, error: "Arquivo vazio. Selecione um extrato válido." };
  }

  const kind: UploadKind = ext === ".pdf" ? "pdf" : "ofx";
  const limit = kind === "pdf" ? MAX_PDF_BYTES : MAX_OFX_BYTES;

  if (file.size > limit) {
    return {
      ok: false,
      error: `Arquivo muito grande (${formatMb(file.size)}). Limite para ${kind.toUpperCase()}: ${formatMb(limit)}.`,
    };
  }

  const mime = (file.type || "").toLowerCase();
  if (kind === "pdf" && mime && mime !== "application/pdf") {
    return { ok: false, error: "O conteúdo não parece ser um PDF válido." };
  }

  return { ok: true, kind };
}

/** Confere a assinatura binária (magic bytes) do arquivo. */
export async function validateFileSignature(file: File, kind: UploadKind): Promise<ValidationResult> {
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const text = new TextDecoder("latin1").decode(head);

  if (kind === "pdf") {
    if (!text.startsWith("%PDF-")) {
      return { ok: false, error: "Arquivo PDF inválido ou corrompido." };
    }
    return { ok: true, kind };
  }

  const upper = text.toUpperCase();
  if (!upper.includes("OFXHEADER") && !upper.includes("<OFX")) {
    return { ok: false, error: "Arquivo OFX inválido: cabeçalho não encontrado." };
  }
  return { ok: true, kind };
}

/** Rate limiter local (janela deslizante em memória). */
export class UploadRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private max = RATE_LIMIT_MAX,
    private windowMs = RATE_LIMIT_WINDOW_MS,
    private minInterval = MIN_INTERVAL_MS
  ) {}

  check(now = Date.now()): { allowed: boolean; error?: string; retryAfterMs?: number } {
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    const last = this.timestamps[this.timestamps.length - 1];
    if (last !== undefined && now - last < this.minInterval) {
      const wait = this.minInterval - (now - last);
      return {
        allowed: false,
        retryAfterMs: wait,
        error: "Aguarde um instante antes de enviar outro arquivo.",
      };
    }

    if (this.timestamps.length >= this.max) {
      const wait = this.windowMs - (now - this.timestamps[0]);
      return {
        allowed: false,
        retryAfterMs: wait,
        error: `Limite de ${this.max} arquivos por minuto atingido. Tente novamente em ${Math.ceil(wait / 1000)}s.`,
      };
    }

    return { allowed: true };
  }

  record(now = Date.now()) {
    this.timestamps.push(now);
  }
}

/** Valida formato, tamanho, assinatura e rate limit em um único passo. */
export async function guardStatementUpload(
  file: File,
  limiter: UploadRateLimiter
): Promise<ValidationResult> {
  const rate = limiter.check();
  if (!rate.allowed) return { ok: false, error: rate.error };

  const basic = validateStatementFile(file);
  if (!basic.ok) return basic;

  const sig = await validateFileSignature(file, basic.kind!);
  if (!sig.ok) return sig;

  limiter.record();
  return { ok: true, kind: basic.kind };
}
