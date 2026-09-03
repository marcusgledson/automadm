import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type ImportMode = "leitura" | "gravacao";

const KEY = "automadm.importMode";

function storageKey(userId?: string) {
  return `${KEY}:${userId ?? "anon"}`;
}

/**
 * Preferência por módulo: "apenas leitura" (processa sem gravar) ou
 * "gravação" (grava na base e libera o painel de destino do arquivo).
 */
export function useImportMode(module: string) {
  const { user } = useAuth();
  const key = `${storageKey(user?.id)}:${module}`;
  const [mode, setModeState] = useState<ImportMode>("gravacao");

  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved === "leitura" || saved === "gravacao") setModeState(saved);
  }, [key]);

  const setMode = useCallback((m: ImportMode) => {
    setModeState(m);
    localStorage.setItem(key, m);
  }, [key]);

  return { mode, setMode, readOnly: mode === "leitura" };
}
