// Validação de arquivos no backend: tamanho, MIME, assinatura e varredura de malware.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_OFX_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARS = 400_000;

export type FileKind = "pdf" | "ofx";

export interface GuardOptions {
  kind: FileKind;
  fileName?: string;
  declaredMime?: string | null;
  source?: string;
}

export interface ScanResult {
  clean: boolean;
  engine: string;
  threats: string[];
  details: Record<string, unknown>;
}

export interface GuardResult {
  ok: boolean;
  reason?: string;
  scan?: ScanResult;
}

const ALLOWED_MIME: Record<FileKind, string[]> = {
  pdf: ["application/pdf", "application/octet-stream", "binary/octet-stream", ""],
  ofx: [
    "application/x-ofx",
    "application/vnd.intu.qfx",
    "text/plain",
    "text/xml",
    "application/xml",
    "application/octet-stream",
    "binary/octet-stream",
    "",
  ],
};

function head(bytes: Uint8Array, n = 1024): string {
  return new TextDecoder("latin1").decode(bytes.subarray(0, n));
}

/** Tamanho, MIME declarado e assinatura binária (magic bytes). */
export function validateBytes(bytes: Uint8Array, opts: GuardOptions): GuardResult {
  const limit = opts.kind === "pdf" ? MAX_PDF_BYTES : MAX_OFX_BYTES;

  if (bytes.byteLength === 0) return { ok: false, reason: "Arquivo vazio." };
  if (bytes.byteLength > limit) {
    return {
      ok: false,
      reason: `Arquivo excede o limite de ${(limit / 1024 / 1024).toFixed(0)} MB (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB).`,
    };
  }

  const mime = (opts.declaredMime || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME[opts.kind].includes(mime)) {
    return { ok: false, reason: `Tipo MIME não permitido para ${opts.kind.toUpperCase()}: ${mime}` };
  }

  if (opts.fileName) {
    const lower = opts.fileName.toLowerCase();
    if (!lower.endsWith(`.${opts.kind}`) && !(opts.kind === "ofx" && lower.endsWith(".qfx"))) {
      return { ok: false, reason: `Extensão de arquivo incompatível com ${opts.kind.toUpperCase()}.` };
    }
  }

  const sample = head(bytes);
  if (opts.kind === "pdf") {
    if (!sample.startsWith("%PDF-")) return { ok: false, reason: "Assinatura de PDF inválida." };
  } else {
    const upper = sample.toUpperCase();
    if (!upper.includes("OFXHEADER") && !upper.includes("<OFX")) {
      return { ok: false, reason: "Assinatura de OFX inválida (cabeçalho ausente)." };
    }
  }

  return { ok: true };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Heurísticas locais de conteúdo perigoso. */
function heuristicScan(bytes: Uint8Array, kind: FileKind): string[] {
  const text = new TextDecoder("latin1").decode(bytes);
  const threats: string[] = [];

  if (kind === "pdf") {
    const patterns: [RegExp, string][] = [
      [/\/JavaScript\b/, "pdf.javascript"],
      [/\/JS\s*[<(\/]/, "pdf.js_action"],
      [/\/Launch\b/, "pdf.launch_action"],
      [/\/EmbeddedFile\b/, "pdf.embedded_file"],
      [/\/RichMedia\b/, "pdf.richmedia"],
      [/\/AA\s*<</, "pdf.auto_action"],
      [/\/SubmitForm\b/, "pdf.submit_form"],
      [/this\.exportDataObject/, "pdf.export_data_object"],
    ];
    for (const [re, id] of patterns) if (re.test(text)) threats.push(id);
  } else {
    if (/<script\b/i.test(text)) threats.push("ofx.script_tag");
    if (/<!ENTITY\b/i.test(text)) threats.push("ofx.xml_entity");
    if (/javascript:/i.test(text)) threats.push("ofx.javascript_uri");
  }

  // Executáveis embutidos (independente do tipo)
  if (text.includes("MZ\x90\x00")) threats.push("embedded.pe_executable");
  if (text.includes("\x7FELF")) threats.push("embedded.elf_executable");
  if (/\bPK\x03\x04.{0,200}\.(exe|scr|js|vbs|bat|cmd|ps1)\b/is.test(text)) {
    threats.push("embedded.archive_executable");
  }

  return threats;
}

/** Consulta opcional ao VirusTotal por hash (sem enviar o arquivo). */
async function virusTotalLookup(hash: string): Promise<{ used: boolean; malicious?: number; suspicious?: number }> {
  const key = Deno.env.get("VIRUSTOTAL_API_KEY");
  if (!key) return { used: false };
  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
      headers: { "x-apikey": key },
    });
    if (res.status === 404) return { used: true, malicious: 0, suspicious: 0 };
    if (!res.ok) return { used: false };
    const json = await res.json();
    const stats = json?.data?.attributes?.last_analysis_stats ?? {};
    return { used: true, malicious: Number(stats.malicious ?? 0), suspicious: Number(stats.suspicious ?? 0) };
  } catch (_) {
    return { used: false };
  }
}

export async function scanFile(bytes: Uint8Array, kind: FileKind): Promise<ScanResult> {
  const hash = await sha256Hex(bytes);
  const threats = heuristicScan(bytes, kind);
  const vt = await virusTotalLookup(hash);

  if (vt.used && (vt.malicious ?? 0) > 0) threats.push(`virustotal.malicious:${vt.malicious}`);
  if (vt.used && (vt.suspicious ?? 0) > 2) threats.push(`virustotal.suspicious:${vt.suspicious}`);

  return {
    clean: threats.length === 0,
    engine: vt.used ? "heuristic+virustotal" : "heuristic",
    threats,
    details: { sha256: hash, size: bytes.byteLength, virustotal: vt },
  };
}

export interface AuditInput {
  userId: string;
  fileName?: string;
  kind: FileKind;
  declaredMime?: string | null;
  size: number;
  source?: string;
  status: "accepted" | "rejected";
  reason?: string;
  scan?: ScanResult;
  req?: Request;
}

export async function logUploadAudit(input: AuditInput): Promise<void> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: org } = await admin.rpc("org_owner_of", { _user_id: input.userId });

    await admin.from("upload_audit_logs").insert({
      user_id: input.userId,
      org_owner_id: org ?? null,
      file_name: input.fileName?.slice(0, 300) ?? null,
      file_kind: input.kind,
      declared_mime: input.declaredMime ?? null,
      file_size: input.size,
      source: input.source ?? "upload",
      status: input.status,
      reject_reason: input.reason ?? null,
      scan_result: input.scan ? (input.scan.clean ? "clean" : "threat") : null,
      scan_details: input.scan ? { engine: input.scan.engine, threats: input.scan.threats, ...input.scan.details } : {},
      client_ip: input.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: input.req?.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch (e) {
    console.error("upload audit log failed:", e instanceof Error ? e.message : String(e));
  }
}

/** Pipeline completo: valida, escaneia e registra auditoria. */
export async function guardAndAudit(
  bytes: Uint8Array,
  opts: GuardOptions & { userId: string; req?: Request },
): Promise<GuardResult> {
  const basic = validateBytes(bytes, opts);
  if (!basic.ok) {
    await logUploadAudit({
      userId: opts.userId,
      fileName: opts.fileName,
      kind: opts.kind,
      declaredMime: opts.declaredMime,
      size: bytes.byteLength,
      source: opts.source,
      status: "rejected",
      reason: basic.reason,
      req: opts.req,
    });
    return basic;
  }

  const scan = await scanFile(bytes, opts.kind);
  const status = scan.clean ? "accepted" : "rejected";
  const reason = scan.clean ? undefined : `Conteúdo suspeito detectado: ${scan.threats.join(", ")}`;

  await logUploadAudit({
    userId: opts.userId,
    fileName: opts.fileName,
    kind: opts.kind,
    declaredMime: opts.declaredMime,
    size: bytes.byteLength,
    source: opts.source,
    status,
    reason,
    scan,
    req: opts.req,
  });

  return scan.clean ? { ok: true, scan } : { ok: false, reason, scan };
}
