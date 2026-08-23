import { bankByAlias, bankByCode, normalizeText, type BankEntry } from "@/lib/bankRegistry";

export type BankDetectionSource = "codigo" | "nome" | "logo" | "manual";

export interface BankDetection {
  code?: string;
  name: string;
  source: BankDetectionSource;
  /** Trecho do texto que originou a identificação (para exibir ao usuário). */
  evidence?: string;
}

/**
 * Cascata de detecção do banco a partir do texto bruto (OFX ou PDF).
 * Etapa 1: código COMPE / BANKID (custo zero)
 * Etapa 2: dicionário de nomes (custo zero)
 * A etapa 3 (logo por IA) é acionada separadamente, sob demanda.
 */
export function detectBankFromText(text: string): BankDetection | undefined {
  if (!text) return undefined;

  // --- Etapa 1: códigos ---
  const codePatterns: RegExp[] = [
    /<BANKID>\s*(\d{3,8})/i,
    /<FID>\s*(\d{3,8})/i,
    /\bbanco\s*[:\-]?\s*(\d{3})\b/i,
    /\bc[oó]digo\s+do\s+banco\s*[:\-]?\s*(\d{3})\b/i,
    /\bcompe\s*[:\-]?\s*(\d{3})\b/i,
    /(^|\s)(\d{3})\s*[-–]\s*banco\b/i,
    /(^|\s)(\d{3})\s*[-–]\s*(?:caixa|santander|itau|ita[úu]|bradesco|sicoob|sicredi|nubank|inter)\b/i,
  ];
  for (const re of codePatterns) {
    const m = text.match(re);
    if (m) {
      const raw = (m[2] ?? m[1] ?? "").replace(/\D/g, "");
      const bank = bankByCode(raw.length > 3 ? raw.slice(0, 3) : raw);
      if (bank) {
        return { code: bank.code, name: bank.name, source: "codigo", evidence: m[0].trim() };
      }
    }
  }

  // --- Etapa 2: dicionário de nomes ---
  const alias: BankEntry | undefined = bankByAlias(text);
  if (alias) {
    const t = normalizeText(text);
    const idx = t.indexOf(alias.aliases.find((a) => t.includes(a)) ?? "");
    const evidence = idx >= 0 ? t.slice(Math.max(0, idx - 12), idx + 40).trim() : undefined;
    return { code: alias.code, name: alias.name, source: "nome", evidence };
  }

  // Fallback: qualquer "Banco XXX" / "XXX Bank" legível
  const generic = text.match(/\b(banco\s+[A-Za-zÀ-ú][A-Za-zÀ-ú.\s]{2,28}|[A-Za-zÀ-ú]{3,20}\s+bank)\b/i);
  if (generic) {
    return { name: generic[1].replace(/\s+/g, " ").trim(), source: "nome", evidence: generic[0] };
  }

  return undefined;
}
