/**
 * Backup criptografado estilo WhatsApp:
 * - AES-GCM 256-bit
 * - Chave derivada via PBKDF2-SHA256 (200k iter) da senha do login + user_id como contexto
 * - Apenas o dono do user_id consegue restaurar (validado antes de derivar a chave)
 *
 * Formato do arquivo (.automadm.enc -> JSON):
 *   {
 *     v: 1,
 *     app: "automadm",
 *     ownerUserId: string,         // exposto em claro para validação
 *     createdAt: string,           // ISO
 *     salt: base64,                // 16 bytes
 *     iv: base64,                  // 12 bytes
 *     ciphertext: base64,          // payload cifrado
 *   }
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERATIONS = 200_000;

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array, userId: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(`${password}:${userId}`) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface BackupEnvelope {
  v: 1;
  app: "automadm";
  ownerUserId: string;
  createdAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptBackup(
  payload: unknown,
  password: string,
  userId: string,
): Promise<BackupEnvelope> {
  if (!password) throw new Error("Senha obrigatória.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, userId);
  const plaintext = enc.encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    v: 1,
    app: "automadm",
    ownerUserId: userId,
    createdAt: new Date().toISOString(),
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ct),
  };
}

export async function decryptBackup<T = unknown>(
  envelope: BackupEnvelope,
  password: string,
  expectedUserId: string,
): Promise<T> {
  if (envelope.app !== "automadm" || envelope.v !== 1) {
    throw new Error("Arquivo de backup inválido ou de versão incompatível.");
  }
  if (envelope.ownerUserId !== expectedUserId) {
    throw new Error("Este backup pertence a outra conta. O restore foi bloqueado.");
  }
  const salt = fromB64(envelope.salt);
  const iv = fromB64(envelope.iv);
  const ct = fromB64(envelope.ciphertext);
  const key = await deriveKey(password, salt, expectedUserId);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
  } catch {
    throw new Error("Senha incorreta ou arquivo corrompido.");
  }
  return JSON.parse(dec.decode(plain)) as T;
}

export function envelopeToBlob(env: BackupEnvelope): Blob {
  return new Blob([JSON.stringify(env)], { type: "application/octet-stream" });
}

export function defaultFileName(userId: string): string {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  return `automadm-backup-${userId.slice(0, 8)}-${stamp}.enc.json`;
}
