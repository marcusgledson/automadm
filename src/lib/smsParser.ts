// SMS bank parser: extracts amount, kind (debit/credit), date, description
// from raw SMS text using per-bank configuration.

export type SmsTxnKind = "debit" | "credit" | "unknown";

export interface SmsBankConfig {
  bank_name: string;
  senders: string[];
  debit_keywords: string[];
  credit_keywords: string[];
  amount_regex?: string | null;
  agencia?: string | null;
  conta?: string | null;
}

export interface ParsedSms {
  bank_name: string;
  kind: SmsTxnKind;
  amount: number | null;
  received_at: string | null; // ISO
  descricao: string | null;
  last_digits: string | null;
  merchant: string | null;
}

// Default amount regex: BR currency like R$ 1.234,56 or 1234,56
const DEFAULT_AMOUNT_RE =
  /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/i;

// dd/mm/yyyy [hh:mm] or dd/mm at hh:mm
const DATE_RE =
  /(\d{2})\/(\d{2})(?:\/(\d{2,4}))?(?:[ ,\-àas]{1,5}(\d{1,2})[:hH](\d{2}))?/;

const LAST_DIGITS_RE =
  /(?:final|term(?:ina)?|cart[aã]o|conta)\D{0,10}(\d{4})/i;

const MERCHANT_RE =
  /(?:em|no|na|estab(?:elecimento)?\.?|compra em)\s+([A-Z0-9][A-Z0-9 &\-\.\*]{2,40})/i;

export function parseBrAmount(raw: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  // "1.234,56" -> 1234.56 ; "1234.56" -> 1234.56
  if (/,\d{2}$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/\.\d{2}$/.test(s) && !s.includes(",")) return Number(s);
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function extractAmount(
  text: string,
  regex?: string | null,
): number | null {
  let re: RegExp = DEFAULT_AMOUNT_RE;
  if (regex) {
    try {
      re = new RegExp(regex, "i");
    } catch {
      re = DEFAULT_AMOUNT_RE;
    }
  }
  const m = text.match(re);
  if (!m) return null;
  const captured = m[1] ?? m[0];
  return parseBrAmount(captured);
}

export function extractDate(text: string, fallback?: Date): string | null {
  const m = text.match(DATE_RE);
  const base = fallback ?? new Date();
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = m[3] ? Number(m[3]) : base.getFullYear();
  if (yyyy < 100) yyyy += 2000;
  const hh = m[4] ? Number(m[4]) : 0;
  const mi = m[5] ? Number(m[5]) : 0;
  const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function extractLastDigits(text: string): string | null {
  const m = text.match(LAST_DIGITS_RE);
  return m ? m[1] : null;
}

export function extractMerchant(text: string): string | null {
  const m = text.match(MERCHANT_RE);
  if (!m) return null;
  return m[1].trim().replace(/\s{2,}/g, " ");
}

function containsAny(text: string, list: string[]): boolean {
  const t = text.toLowerCase();
  return list.some((k) => k && t.includes(k.toLowerCase()));
}

// Heurísticas usadas quando as palavras-chave do banco não decidem.
const FALLBACK_DEBIT = [
  "compra", "compra aprovada", "débito", "debito", "pagamento", "pagto",
  "pix enviado", "pix env", "transferência enviada", "transferencia enviada",
  "saque", "ted enviada", "doc enviado", "tarifa", "débito automático",
  "debito automatico", "boleto pago", "fatura",
];
const FALLBACK_CREDIT = [
  "crédito", "credito", "recebido", "pix recebido", "depósito", "deposito",
  "ted recebida", "doc recebido", "transferência recebida", "transferencia recebida",
  "salário", "salario", "estorno", "reembolso", "devolução", "devolucao",
];

export function detectKind(
  text: string,
  cfg: Pick<SmsBankConfig, "debit_keywords" | "credit_keywords">,
): SmsTxnKind {
  const isDebit = containsAny(text, cfg.debit_keywords);
  const isCredit = containsAny(text, cfg.credit_keywords);
  if (isDebit && !isCredit) return "debit";
  if (isCredit && !isDebit) return "credit";
  const fbDebit = containsAny(text, FALLBACK_DEBIT);
  const fbCredit = containsAny(text, FALLBACK_CREDIT);
  if (fbDebit && !fbCredit) return "debit";
  if (fbCredit && !fbDebit) return "credit";
  // Sinal explícito de valor negativo/positivo no texto.
  if (/-\s*r\$/i.test(text)) return "debit";
  if (/\+\s*r\$/i.test(text)) return "credit";
  return "unknown";
}

export function matchesSender(sender: string, cfg: SmsBankConfig): boolean {
  if (!sender) return false;
  const s = sender.toLowerCase();
  return cfg.senders.some((k) => k && s.includes(k.toLowerCase()));
}

export function parseSms(
  sender: string,
  text: string,
  cfg: SmsBankConfig,
  receivedAt?: Date,
): ParsedSms {
  const amount = extractAmount(text, cfg.amount_regex);
  const kind = detectKind(text, cfg);
  const received_at = extractDate(text, receivedAt) ??
    (receivedAt ? receivedAt.toISOString() : null);
  const last_digits = extractLastDigits(text);
  const merchant = extractMerchant(text);
  const descricao = merchant ?? text.slice(0, 120);
  return {
    bank_name: cfg.bank_name,
    kind,
    amount,
    received_at,
    descricao,
    last_digits,
    merchant,
  };
}

// ---------- Bank presets ----------
export const BANK_PRESETS: SmsBankConfig[] = [
  {
    bank_name: "Itaú",
    senders: ["ITAU", "ITAÚ"],
    debit_keywords: ["compra", "débito", "debito", "pagamento", "pix enviado", "saque"],
    credit_keywords: ["crédito", "credito", "recebido", "pix recebido", "depósito", "deposito", "ted recebida"],
  },
  {
    bank_name: "Bradesco",
    senders: ["BRADESCO"],
    debit_keywords: ["compra", "débito", "debito", "pagamento", "pix enviado", "saque"],
    credit_keywords: ["crédito", "credito", "recebido", "pix recebido", "depósito", "deposito"],
  },
  {
    bank_name: "Banco do Brasil",
    senders: ["BB", "BANCO DO BRASIL"],
    debit_keywords: ["compra", "débito", "debito", "pagamento", "pix enviado", "saque"],
    credit_keywords: ["crédito", "credito", "recebido", "pix recebido", "depósito", "deposito"],
  },
  {
    bank_name: "Santander",
    senders: ["SANTANDER"],
    debit_keywords: ["compra", "débito", "debito", "pagamento", "pix enviado", "saque"],
    credit_keywords: ["crédito", "credito", "recebido", "pix recebido", "depósito", "deposito"],
  },
  {
    bank_name: "Caixa",
    senders: ["CAIXA"],
    debit_keywords: ["compra", "débito", "debito", "pagamento", "pix enviado", "saque"],
    credit_keywords: ["crédito", "credito", "recebido", "pix recebido", "depósito", "deposito"],
  },
  {
    bank_name: "Nubank",
    senders: ["NUBANK", "NU"],
    debit_keywords: ["compra aprovada", "pagamento", "pix enviado"],
    credit_keywords: ["recebido", "pix recebido", "reembolso"],
  },
  {
    bank_name: "C6 Bank",
    senders: ["C6", "C6 BANK"],
    debit_keywords: ["compra", "débito", "debito", "pagamento", "pix enviado"],
    credit_keywords: ["crédito", "credito", "recebido", "pix recebido"],
  },
];
