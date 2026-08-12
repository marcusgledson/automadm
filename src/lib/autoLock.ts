// Configuração do tempo de expiração da sessão local (auto-bloqueio).

const KEY = "app_autolock_minutes";
export const AUTOLOCK_OPTIONS = [1, 5, 15, 30] as const;
export const DEFAULT_AUTOLOCK_MINUTES = 5;

export function getAutoLockMinutes(): number {
  const raw = Number(localStorage.getItem(KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AUTOLOCK_MINUTES;
}

export function setAutoLockMinutes(minutes: number) {
  localStorage.setItem(KEY, String(minutes));
  window.dispatchEvent(new Event("autolock:change"));
}
