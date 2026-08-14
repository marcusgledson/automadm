// Bloqueio por PIN — alternativa à biometria, funciona em qualquer aparelho.
// O PIN nunca é armazenado em texto puro: guardamos apenas o hash SHA-256
// com um "salt" aleatório por usuário, no próprio dispositivo.

const PIN_PREFIX = "app_pin_";

type StoredPin = { salt: string; hash: string };

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

function read(userId: string): StoredPin | null {
  try {
    const raw = localStorage.getItem(PIN_PREFIX + userId);
    return raw ? (JSON.parse(raw) as StoredPin) : null;
  } catch {
    return null;
  }
}

export function isPinEnabled(userId: string) {
  return !!read(userId);
}

export function isValidPinFormat(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

export async function setPin(userId: string, pin: string) {
  if (!isValidPinFormat(pin)) throw new Error("O PIN deve ter de 4 a 8 dígitos numéricos.");
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await hashPin(pin, salt);
  localStorage.setItem(PIN_PREFIX + userId, JSON.stringify({ salt, hash }));
}

export function removePin(userId: string) {
  localStorage.removeItem(PIN_PREFIX + userId);
}

export async function verifyPin(userId: string, pin: string) {
  const stored = read(userId);
  if (!stored) return false;
  return (await hashPin(pin, stored.salt)) === stored.hash;
}

// --- Registro de contas com PIN neste aparelho -------------------------------
// Permite entrar direto pelo PIN na tela inicial, sem digitar e-mail/senha.

const PIN_USERS_KEY = "app_pin_users";

export type PinUser = { userId: string; email: string };

export function listPinUsers(): PinUser[] {
  try {
    const raw = localStorage.getItem(PIN_USERS_KEY);
    const list = raw ? (JSON.parse(raw) as PinUser[]) : [];
    return list.filter((u) => u?.userId && isPinEnabled(u.userId));
  } catch {
    return [];
  }
}

export function rememberPinUser(user: PinUser) {
  const list = listPinUsers().filter((u) => u.userId !== user.userId);
  localStorage.setItem(PIN_USERS_KEY, JSON.stringify([user, ...list]));
}

export function forgetPinUser(userId: string) {
  const list = listPinUsers().filter((u) => u.userId !== userId);
  localStorage.setItem(PIN_USERS_KEY, JSON.stringify(list));
}
