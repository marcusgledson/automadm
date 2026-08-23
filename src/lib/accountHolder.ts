/**
 * Extração do titular da conta (Nome / CPF / CNPJ) a partir do texto
 * de um extrato (PDF ou OFX). Custo zero — apenas regex local.
 */

export interface HolderInfo {
  titular?: string;
  documento?: string;
  documentoTipo?: "CPF" | "CNPJ";
}

const CPF = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/;
const CNPJ = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/;
const CPF_LABEL = /\bcpf\s*[:\-]?\s*([\d.\-*]{11,14})/i;
const CNPJ_LABEL = /\bcnpj\s*[:\-]?\s*([\d./\-*]{14,18})/i;

const NAME_LABEL =
  /\b(?:cliente|titular|nome(?:\s+do\s+titular)?|raz[aã]o\s+social|benefici[aá]rio)\s*[:\-]\s*([A-Za-zÀ-ú][A-Za-zÀ-ú'.\s&]{4,60})/i;

/** Mascara o documento para exibição: 123.***.***-45 */
export function maskDocument(doc?: string): string {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/${d.slice(8, 12)}-${d.slice(12)}`;
  return doc;
}

/** Normaliza documento para comparação (somente dígitos). */
export function normalizeDocument(doc?: string): string {
  return (doc ?? "").replace(/\D/g, "");
}

function cleanName(raw: string): string {
  return raw
    .replace(/\b(cpf|cnpj|documento|doc|ag[eê]ncia|conta)\b\.?\s*:?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-zÀ-ú'.&\s]/g, "")
    .trim()
    .slice(0, 60);
}

/** Extrai titular e documento das linhas do extrato. */
export function extractHolder(lines: string[]): HolderInfo {
  const joined = lines.join("\n");
  const info: HolderInfo = {};

  const cnpj = joined.match(CNPJ)?.[1] ?? joined.match(CNPJ_LABEL)?.[1];
  const cpf = joined.match(CPF)?.[1] ?? joined.match(CPF_LABEL)?.[1];
  if (cnpj && normalizeDocument(cnpj).length === 14) {
    info.documento = cnpj.trim();
    info.documentoTipo = "CNPJ";
  } else if (cpf && normalizeDocument(cpf).length === 11) {
    info.documento = cpf.trim();
    info.documentoTipo = "CPF";
  }

  // 1) rótulo explícito
  const labeled = joined.match(NAME_LABEL)?.[1];
  if (labeled) {
    const n = cleanName(labeled);
    if (n.split(" ").length >= 2) info.titular = n;
  }

  // 2) linha próxima ao documento (mesma linha ou anterior)
  if (!info.titular && info.documento) {
    const idx = lines.findIndex((l) => l.includes(info.documento as string));
    if (idx >= 0) {
      const candidates = [
        lines[idx].split(info.documento as string)[0],
        lines[idx - 1] ?? "",
      ];
      for (const c of candidates) {
        const n = cleanName(c.replace(/\b(cpf|cnpj|documento)\b/gi, ""));
        if (n.split(" ").filter(Boolean).length >= 2 && n.length >= 6) {
          info.titular = n;
          break;
        }
      }
    }
  }

  return info;
}

export interface KnownAccount {
  id: string;
  apelido: string;
  agencia: string;
  conta: string;
  banco?: string | null;
  titular?: string | null;
  documento?: string | null;
}

export type MatchReason = "documento" | "agencia_conta" | "titular";

export interface AccountMatch {
  account: KnownAccount;
  reason: MatchReason;
  /** Divergências encontradas em relação ao arquivo atual. */
  conflicts: string[];
}

/**
 * Compara campo a campo os dados detectados no arquivo com as contas já
 * cadastradas, sugerindo a conta correspondente e apontando conflitos.
 */
export function matchAccount(
  detected: { agencia?: string; conta?: string; titular?: string; documento?: string },
  known: KnownAccount[],
): AccountMatch | undefined {
  const digitsOnly = (s?: string | null) => (s ?? "").replace(/\D/g, "");
  const doc = normalizeDocument(detected.documento);
  const ag = digitsOnly(detected.agencia);
  const cc = digitsOnly(detected.conta);

  const byKey = known.find(
    (k) => ag && cc && digitsOnly(k.agencia) === ag && digitsOnly(k.conta) === cc,
  );
  const byDoc = doc ? known.find((k) => normalizeDocument(k.documento ?? "") === doc) : undefined;
  const byName =
    detected.titular
      ? known.find(
          (k) => (k.titular ?? "").toLowerCase().trim() === detected.titular?.toLowerCase().trim(),
        )
      : undefined;

  const account = byKey ?? byDoc ?? byName;
  if (!account) return undefined;

  const reason: MatchReason = byKey ? "agencia_conta" : byDoc ? "documento" : "titular";
  const conflicts: string[] = [];

  if (byKey && doc && normalizeDocument(byKey.documento ?? "") && normalizeDocument(byKey.documento ?? "") !== doc) {
    conflicts.push("O documento (CPF/CNPJ) do arquivo é diferente do cadastrado nesta conta.");
  }
  if (byKey && detected.titular && byKey.titular && byKey.titular.toLowerCase() !== detected.titular.toLowerCase()) {
    conflicts.push("O titular do arquivo é diferente do titular cadastrado nesta conta.");
  }
  if (!byKey && byDoc && ag && cc && (digitsOnly(byDoc.agencia) !== ag || digitsOnly(byDoc.conta) !== cc)) {
    conflicts.push("Mesmo documento já cadastrado em outra agência/conta.");
  }

  return { account, reason, conflicts };
}
