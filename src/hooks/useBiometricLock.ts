import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  disableBiometric,
  enrollBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  verifyBiometric,
} from "@/lib/biometrics";
import {
  isPinEnabled,
  rememberPinUser,
  forgetPinUser,
  removePin as removePinStore,
  setPin as setPinStore,
  verifyPin as verifyPinStore,
} from "@/lib/pinLock";
import {
  clearLockout,
  readLockout,
  registerFailure,
  remainingSeconds,
  attemptsLeft as attemptsLeftStore,
} from "@/lib/lockout";
import { getAutoLockMinutes } from "@/lib/autoLock";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

/**
 * Bloqueio do aplicativo por segurança do aparelho:
 * biometria / reconhecimento facial ou, se o usuário preferir, um PIN local.
 * Inclui expiração por inatividade / segundo plano e lockout por tentativas.
 */
export function useBiometricLock() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const lastActivity = useRef(Date.now());

  const protectionOn = (available && enabled) || pinEnabled;

  useEffect(() => {
    let active = true;
    (async () => {
      const av = await isBiometricAvailable();
      if (!active) return;
      setAvailable(av);
      const bio = !!user && isBiometricEnabled(user.id);
      const pin = !!user && isPinEnabled(user.id);
      setEnabled(bio);
      setPinEnabled(pin);
      setLocked((av && bio) || pin);
      if (user) {
        setLockoutSeconds(remainingSeconds(readLockout(user.id)));
        setAttemptsLeft(attemptsLeftStore(user.id));
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Contador regressivo do bloqueio temporário.
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      setLockoutSeconds(remainingSeconds(readLockout(user.id)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [user?.id]);

  const registerFail = useCallback(() => {
    if (!user) return;
    const state = registerFailure(user.id);
    setLockoutSeconds(remainingSeconds(state));
    setAttemptsLeft(attemptsLeftStore(user.id));
  }, [user?.id]);

  const onSuccess = useCallback(() => {
    if (user) clearLockout(user.id);
    setLockoutSeconds(0);
    setAttemptsLeft(attemptsLeftStore(user?.id ?? ""));
    lastActivity.current = Date.now();
    setLocked(false);
  }, [user?.id]);

  const unlock = useCallback(async () => {
    if (!user || lockoutSeconds > 0) return false;
    const ok = await verifyBiometric(user.id);
    if (ok) onSuccess();
    else registerFail();
    return ok;
  }, [user?.id, lockoutSeconds, onSuccess, registerFail]);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      if (!user || lockoutSeconds > 0) return false;
      const ok = await verifyPinStore(user.id, pin);
      if (ok) onSuccess();
      else registerFail();
      return ok;
    },
    [user?.id, lockoutSeconds, onSuccess, registerFail],
  );

  const enable = useCallback(async () => {
    if (!user) return;
    await enrollBiometric(user.id, user.email ?? "usuário");
    setEnabled(true);
  }, [user?.id, user?.email]);

  const disable = useCallback(() => {
    if (!user) return;
    disableBiometric(user.id);
    setEnabled(false);
    if (!isPinEnabled(user.id)) setLocked(false);
  }, [user?.id]);

  const definePin = useCallback(
    async (pin: string) => {
      if (!user) return;
      await setPinStore(user.id, pin);
      rememberPinUser({ userId: user.id, email: user.email ?? "sua conta" });
      setPinEnabled(true);
      clearLockout(user.id);
      setLockoutSeconds(0);
    },
    [user?.id],
  );

  /** Remove o PIN somente após validar o PIN atual. */
  const disablePinWithCurrent = useCallback(
    async (currentPin: string) => {
      if (!user) return false;
      const ok = await verifyPinStore(user.id, currentPin);
      if (!ok) {
        registerFail();
        return false;
      }
      removePinStore(user.id);
      forgetPinUser(user.id);
      setPinEnabled(false);
      clearLockout(user.id);
      setLockoutSeconds(0);
      if (!isBiometricEnabled(user.id)) setLocked(false);
      return true;
    },
    [user?.id, registerFail],
  );

  /** Verificação biométrica usada para autorizar a redefinição do PIN esquecido. */
  const verifyForPinReset = useCallback(async () => {
    if (!user) return false;
    const ok = await verifyBiometric(user.id);
    if (!ok) registerFail();
    return ok;
  }, [user?.id, registerFail]);

  const clearPin = useCallback(() => {
    if (!user) return;
    removePinStore(user.id);
    forgetPinUser(user.id);
    setPinEnabled(false);
    if (!isBiometricEnabled(user.id)) setLocked(false);
  }, [user?.id]);

  // Sincroniza o bloqueio entre instâncias do hook (menu ↔ rota protegida).
  useEffect(() => {
    const onLock = () => setLocked(true);
    window.addEventListener("biometric:lock", onLock);
    return () => window.removeEventListener("biometric:lock", onLock);
  }, []);

  const lock = useCallback(() => window.dispatchEvent(new Event("biometric:lock")), []);

  // Expiração por inatividade e por tempo em segundo plano.
  useEffect(() => {
    if (!protectionOn || locked) return;
    let limitMs = getAutoLockMinutes() * 60_000;
    const onConfig = () => {
      limitMs = getAutoLockMinutes() * 60_000;
    };
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const check = () => {
      if (Date.now() - lastActivity.current >= limitMs) lock();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") touch();
      else check();
    };

    touch();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("autolock:change", onConfig);
    const id = window.setInterval(check, 15_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("autolock:change", onConfig);
      window.clearInterval(id);
    };
  }, [protectionOn, locked, lock]);

  return {
    available,
    enabled,
    pinEnabled,
    locked,
    checking,
    lockoutSeconds,
    attemptsLeft,
    unlock,
    unlockWithPin,
    enable,
    disable,
    definePin,
    disablePinWithCurrent,
    verifyForPinReset,
    clearPin,
    lock,
  };
}
