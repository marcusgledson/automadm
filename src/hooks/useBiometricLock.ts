import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  disableBiometric,
  enrollBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  verifyBiometric,
} from "@/lib/biometrics";

/**
 * Bloqueio por segurança nativa do aparelho (biometria / reconhecimento facial).
 * Quando ativado, a sessão fica bloqueada até a confirmação biométrica.
 */
export function useBiometricLock() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const av = await isBiometricAvailable();
      if (!active) return;
      setAvailable(av);
      const on = !!user && isBiometricEnabled(user.id);
      setEnabled(on);
      setLocked(av && on);
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

  const enable = useCallback(async () => {
    if (!user) return;
    await enrollBiometric(user.id, user.email ?? "usuário");
    setEnabled(true);
  }, [user?.id, user?.email]);

  const disable = useCallback(() => {
    if (!user) return;
    disableBiometric(user.id);
    setEnabled(false);
    setLocked(false);
  }, [user?.id]);

  const lock = useCallback(() => setLocked(true), []);

  return { available, enabled, locked, checking, unlock, enable, disable, lock };
}
