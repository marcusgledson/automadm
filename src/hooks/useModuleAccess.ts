import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, MODULES } from "@/hooks/useAppSettings";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

const ALL_MODULES = MODULES.map((m) => m.id);

/**
 * Reúne as três camadas de permissão:
 * 1. módulos habilitados na organização (app_settings)
 * 2. módulos liberados para o perfil (role_modules)
 * 3. módulos liberados para o usuário (profiles.allowed_modules)
 */
export function useModuleAccess() {
  const { settings, loading: settingsLoading } = useAppSettings();
  const { profile, loading: profileLoading } = useProfile();
  const { role, orgOwnerId, isMaster, loading: roleLoading } = useUserRole();
  const [roleModules, setRoleModules] = useState<string[] | null>(null);
  const [loadingRoleModules, setLoadingRoleModules] = useState(true);

  const load = useCallback(async () => {
    if (!role || !orgOwnerId) {
      setRoleModules(null);
      setLoadingRoleModules(false);
      return;
    }
    setLoadingRoleModules(true);
    const { data } = await supabase
      .from("role_modules")
      .select("allowed_modules")
      .eq("org_owner_id", orgOwnerId)
      .eq("role", role as AppRole)
      .maybeSingle();
    setRoleModules((data?.allowed_modules as string[] | undefined) ?? null);
    setLoadingRoleModules(false);
  }, [role, orgOwnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed = useMemo(() => {
    const orgEnabled = settings?.enabled_modules?.length ? settings.enabled_modules : ALL_MODULES;
    if (isMaster) return orgEnabled;
    const byRole = roleModules ?? ALL_MODULES;
    const byUser = profile?.allowed_modules?.length ? profile.allowed_modules : ALL_MODULES;
    return orgEnabled.filter((m) => byRole.includes(m) && byUser.includes(m));
  }, [settings, isMaster, roleModules, profile]);

  const loading = settingsLoading || profileLoading || roleLoading || loadingRoleModules;

  const canAccess = useCallback((moduleId: string) => allowed.includes(moduleId), [allowed]);

  return { allowed, canAccess, loading, refresh: load };
}
