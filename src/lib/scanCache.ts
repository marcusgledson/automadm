/**
 * Cache local do resultado da varredura de arquivos, indexado pelo hash SHA-256.
 * Evita reenviar e reprocessar o mesmo arquivo dentro do TTL configurado.
 */

export const DEFAULT_SCAN_CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72h
const STORAGE_KEY = "upload-scan-cache-v1";
const MAX_ENTRIES = 200;

export interface CachedScan {
  verdict: "accepted" | "rejected";
  reason?: string;
  engine?: string;
  expiresAt: number;
}

type CacheMap = Record<string, CachedScan>;

/** Hash SHA-256 (hex) do conteúdo do arquivo. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function read(): CacheMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    return {};
  }
}

function write(map: CacheMap) {
  try {
    const entries = Object.entries(map)
      .filter(([, v]) => v.expiresAt > Date.now())
      .sort((a, b) => b[1].expiresAt - a[1].expiresAt)
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* armazenamento indisponível: cache apenas em memória do backend */
  }
}

export function getCachedScan(hash: string): CachedScan | null {
  const entry = read()[hash];
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry;
}

export function setCachedScan(
  hash: string,
  value: Omit<CachedScan, "expiresAt">,
  ttlMs = DEFAULT_SCAN_CACHE_TTL_MS,
) {
  const map = read();
  map[hash] = { ...value, expiresAt: Date.now() + ttlMs };
  write(map);
}

export function clearScanCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
