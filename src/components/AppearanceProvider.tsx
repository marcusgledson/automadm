import { createContext, useContext, useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { applyAppearance, cacheAppearance, readCachedAppearance } from "@/lib/appearance";

const AppearanceContext = createContext<boolean | undefined>(undefined);

/** Indica se o AppearanceProvider está registrado acima na árvore. */
export function useAppearanceReady() {
  return useContext(AppearanceContext) === true;
}

/**
 * Aplica a paleta e o tema salvos no banco assim que o app carrega.
 * Usa um cache local para evitar "piscar" a paleta padrão antes da consulta.
 */
export default function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();

  useEffect(() => {
    const cached = readCachedAppearance();
    if (cached) applyAppearance(cached.palette, cached.theme_style);
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyAppearance(settings.palette, settings.theme_style);
    cacheAppearance(settings.palette, settings.theme_style);
  }, [settings?.palette, settings?.theme_style]);

  return <AppearanceContext.Provider value={true}>{children}</AppearanceContext.Provider>;
}
