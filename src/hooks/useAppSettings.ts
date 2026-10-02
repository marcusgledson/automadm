import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PALETTES as APPEARANCE_PALETTES, THEME_STYLES } from "@/lib/appearance";


export type UsageMode = "pessoal" | "coparticipativo" | "corporativo";

export interface AppSettings {
  id: string;
  owner_id: string;
  usage_mode: UsageMode;
  onboarding_done: boolean;
  enabled_modules: string[];
  palette: string;
  theme_style: string;
  logo_url: string | null;
  org_name: string | null;
}

export const MODULES = [
  { id: "extrato", label: "Análise de Extrato Bancário" },
  { id: "contas", label: "Central de Contas e Despesas" },
  { id: "energia", label: "Faturas de Energia (avançado)" },
  { id: "investimentos", label: "Meus Investimentos" },
  { id: "metas", label: "Metas e Orçamento" },
  { id: "sms", label: "Leitura de SMS bancário" },
] as const;

/** Paletas no formato usado pelas telas (cores apenas para pré-visualização). */
export const PALETTES = APPEARANCE_PALETTES.map((p) => ({
  id: p.id,
  label: p.label,
  colors: p.swatch,
}));

export { THEME_STYLES };


export function useAppSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Convidados usam a configuração da empresa (dono da organização).
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("org_owner_id")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const ownerId = (roleRow?.org_owner_id as string | undefined) ?? user.id;
    setOwnerId(ownerId);
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();
    setSettings((data as AppSettings) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: Partial<Omit<AppSettings, "id" | "owner_id">>) => {
      if (!user) return { ok: false, error: "Não autenticado" };
      if (ownerId && ownerId !== user.id)
        return { ok: false, error: "apenas o responsável pela empresa pode alterar estas configurações." };
      const { error } = await supabase
        .from("app_settings")
        .upsert({ owner_id: user.id, ...patch }, { onConflict: "owner_id" });
      if (error) return { ok: false, error: error.message };
      await refresh();
      return { ok: true };
    },
    [user, ownerId, refresh],
  );

  const isModuleEnabled = useCallback(
    (id: string) => !settings || settings.enabled_modules.includes(id),
    [settings],
  );

  return { settings, loading, canEdit: !ownerId || ownerId === user?.id, save, refresh, isModuleEnabled };
}
