import { useCallback, useEffect, useState } from "react";
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
  removePin as removePinStore,
  setPin as setPinStore,
  verifyPin as verifyPinStore,
} from "@/lib/pinLock";

/**
 * Bloqueio do aplicativo por segurança do aparelho:
 * biometria / reconhecimento facial ou, se o usuário preferir, um PIN local.
 */
export function useBiometricLock() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);

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
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const unlock = useCallback(async () => {
    if (!user) return false;
    const ok = await verifyBiometric(user.id);
    if (ok) setLocked(false);
    return ok;
  }, [user?.id]);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      if (!user) return false;
      const ok = await verifyPinStore(user.id, pin);
      if (ok) setLocked(false);
      return ok;
    },
    [user?.id],
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
      setPinEnabled(true);
    },
    [user?.id],
  );

  const clearPin = useCallback(() => {
    if (!user) return;
    removePinStore(user.id);
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

  return {
    available,
    enabled,
    pinEnabled,
    locked,
    checking,
    unlock,
    unlockWithPin,
    enable,
    disable,
    definePin,
    clearPin,
    lock,
  };
}
