// Bloqueio temporário após várias tentativas incorretas de PIN / biometria.
// Estado guardado apenas no aparelho.

const KEY = "app_lockout_";
export const MAX_ATTEMPTS = 5;
// Espera progressiva (em segundos) conforme o número de bloqueios consecutivos.
const DELAYS = [30, 60, 300, 900];

type LockoutState = { attempts: number; lockUntil: number; strikes: number };

const empty: LockoutState = { attempts: 0, lockUntil: 0, strikes: 0 };

export function readLockout(userId: string): LockoutState {
  try {
    const raw = localStorage.getItem(KEY + userId);
    return raw ? { ...empty, ...(JSON.parse(raw) as LockoutState) } : { ...empty };
  } catch {
    return { ...empty };
  }
}

function write(userId: string, state: LockoutState) {
  localStorage.setItem(KEY + userId, JSON.stringify(state));
}

/** Segundos restantes de bloqueio (0 se liberado). */
export function remainingSeconds(state: LockoutState) {
  return Math.max(0, Math.ceil((state.lockUntil - Date.now()) / 1000));
}

export function isLockedOut(userId: string) {
  return remainingSeconds(readLockout(userId)) > 0;
}

/** Registra uma tentativa incorreta e devolve o novo estado. */
export function registerFailure(userId: string): LockoutState {
  const state = readLockout(userId);
  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    const strikes = state.strikes + 1;
    const delay = DELAYS[Math.min(strikes - 1, DELAYS.length - 1)];
    const next = { attempts: 0, strikes, lockUntil: Date.now() + delay * 1000 };
    write(userId, next);
    return next;
  }
  const next = { ...state, attempts };
  write(userId, next);
  return next;
}

/** Limpa o contador após um desbloqueio bem-sucedido. */
export function clearLockout(userId: string) {
  localStorage.removeItem(KEY + userId);
}

export function attemptsLeft(userId: string) {
  return Math.max(0, MAX_ATTEMPTS - readLockout(userId).attempts);
}
