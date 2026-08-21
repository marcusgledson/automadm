import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODULES } from "@/hooks/useAppSettings";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

const ALL = MODULES.map((m) => m.id);

export function useRoleModules(enabled: boolean) {
  const { orgOwnerId } = useUserRole();
  const [map, setMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled || !orgOwnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("role_modules")
      .select("role, allowed_modules")
      .eq("org_owner_id", orgOwnerId);
    const next: Record<string, string[]> = {};
    (data ?? []).forEach((r) => {
      next[r.role as string] = (r.allowed_modules as string[]) ?? [];
    });
    setMap(next);
    setLoading(false);
  }, [enabled, orgOwnerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const modulesFor = useCallback((role: AppRole) => map[role] ?? ALL, [map]);

  const setModules = useCallback(
    async (role: AppRole, modules: string[]) => {
      if (!orgOwnerId) return { ok: false, error: "Organização não identificada." };
      const { error } = await supabase
        .from("role_modules")
        .upsert({ org_owner_id: orgOwnerId, role, allowed_modules: modules }, { onConflict: "org_owner_id,role" });
      if (error) return { ok: false, error: error.message };
      setMap((prev) => ({ ...prev, [role]: modules }));
      return { ok: true };
    },
    [orgOwnerId],
  );

  return { modulesFor, setModules, loading, refresh };
}
