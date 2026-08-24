import { BANKS, bankByCode, normalizeText, type BankEntry } from "@/lib/bankRegistry";

export type BankDetectionSource = "codigo" | "nome" | "logo" | "manual";
export type BankConfidence = "alta" | "media" | "baixa";

export interface BankCandidate {
  code?: string;
  name: string;
  score: number;
}

export interface BankDetection {
  code?: string;
  name: string;
  source: BankDetectionSource;
  /** Trecho do texto que originou a identificação (para exibir ao usuário). */
  evidence?: string;
  /** Confiança da detecção automática. */
  confidence?: BankConfidence;
  /** Outros bancos citados no documento, ordenados por pontuação. */
  alternatives?: BankCandidate[];
}

/** Linha de lançamento (contém valor monetário) — nela aparecem bancos de terceiros. */
function isTransactionLine(line: string): boolean {
  return /\d,\d{2}/.test(line) || /\bpix\b|\bted\b|\bdoc\b|transfer[êe]ncia/i.test(line);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countAlias(text: string, alias: string): number {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(alias)}([^a-z0-9]|$)`, "g");
  let n = 0;
  while (re.exec(text) !== null) n++;
  return n;
}

/**
 * Pontua cada banco do registro conforme onde seu nome aparece:
 * cabeçalho do documento pesa muito mais que o corpo, e linhas de
 * lançamento (contrapartidas de Pix/TED) quase não pontuam.
 */
function scoreBanks(text: string): { entry: BankEntry; score: number; evidence?: string }[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = rawLines.slice(0, 25);
  const info = rawLines.filter((l) => !isTransactionLine(l));
  const tx = rawLines.filter(isTransactionLine);

  const nHeader = normalizeText(header.join("\n"));
  const nInfo = normalizeText(info.join("\n"));
  const nTx = normalizeText(tx.join("\n"));

  const out: { entry: BankEntry; score: number; evidence?: string }[] = [];
  for (const entry of BANKS) {
    let score = 0;
    let evidence: string | undefined;
    for (const alias of entry.aliases) {
      if (alias.length < 3) continue;
      // Apelidos muito curtos ("bb", "inter") só valem no cabeçalho.
      const weightBonus = Math.min(alias.length / 8, 2);
      const h = countAlias(nHeader, alias);
      const i = countAlias(nInfo, alias);
      const t = countAlias(nTx, alias);
      score += h * 4 * weightBonus + i * 1.2 * weightBonus + t * 0.05;
      if ((h > 0 || i > 0) && !evidence) {
        const src = h > 0 ? nHeader : nInfo;
        const idx = src.indexOf(alias);
        if (idx >= 0) evidence = src.slice(Math.max(0, idx - 15), idx + 45).trim();
      }
    }
    if (score > 0) out.push({ entry, score, evidence });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Cascata de detecção do banco a partir do texto bruto (OFX ou PDF).
 * Etapa 1: código COMPE / BANKID (custo zero)
 * Etapa 2: pontuação por nome, priorizando o cabeçalho (custo zero)
 * A etapa 3 (logo por IA) é acionada automaticamente quando a confiança é baixa.
 */
export function detectBankFromText(text: string): BankDetection | undefined {
  if (!text) return undefined;

  const ranked = scoreBanks(text);
  const alternatives: BankCandidate[] = ranked
    .slice(0, 4)
    .map((r) => ({ code: r.entry.code, name: r.entry.name, score: Math.round(r.score * 10) / 10 }));

  // --- Etapa 1: códigos ---
  const codePatterns: RegExp[] = [
    /<BANKID>\s*(\d{3,8})/i,
    /<FID>\s*(\d{3,8})/i,
    /\bbanco\s*[:\-]?\s*(\d{3})\b/i,
    /\bc[oó]digo\s+do\s+banco\s*[:\-]?\s*(\d{3})\b/i,
    /\bcompe\s*[:\-]?\s*(\d{3})\b/i,
    /\bism[pf]?\s*[:\-]?\s*(\d{3})\b/i,
    /(^|\s)(\d{3})\s*[-–|/]\s*banco\b/i,
    /(^|\s)(\d{3})\s*[-–|/]\s*(?:caixa|santander|itau|ita[úu]|bradesco|sicoob|sicredi|nubank|inter|banrisul|safra|bmg|c6|original|pan|will|neon|next|picpay|mercado\s*pago|stone|pagbank|banco)\b/i,
    /banco\s*[:\-]?\s*(\d{3})\s*[-–|/]/i,
  ];
  for (const re of codePatterns) {
    const m = text.match(re);
    if (m) {
      const raw = (m[2] ?? m[1] ?? "").replace(/\D/g, "");
      const bank = bankByCode(raw.length > 3 ? raw.slice(0, 3) : raw);
      if (bank) {
        return {
          code: bank.code,
          name: bank.name,
          source: "codigo",
          evidence: m[0].trim(),
          confidence: "alta",
          alternatives,
        };
      }
    }
  }

  // --- Etapa 2: nome pontuado ---
  const top = ranked[0];
  if (top) {
    const runnerUp = ranked[1]?.score ?? 0;
    const clear = top.score >= runnerUp * 1.8;
    const confidence: BankConfidence =
      top.score >= 4 && clear ? "alta" : top.score >= 1.2 ? "media" : "baixa";
    return {
      code: top.entry.code,
      name: top.entry.name,
      source: "nome",
      evidence: top.evidence,
      confidence,
      alternatives,
    };
  }

  // Fallback: qualquer "Banco XXX" / "XXX Bank" legível
  const generic = text.match(/\b(banco\s+[A-Za-zÀ-ú][A-Za-zÀ-ú.\s]{2,28}|[A-Za-zÀ-ú]{3,20}\s+bank)\b/i);
  if (generic) {
    return {
      name: generic[1].replace(/\s+/g, " ").trim(),
      source: "nome",
      evidence: generic[0],
      confidence: "baixa",
      alternatives,
    };
  }

  return undefined;
}

/** Indica se vale acionar a identificação por logo (IA). */
export function needsLogoFallback(d?: BankDetection): boolean {
  return !d || d.confidence === "baixa";
}
