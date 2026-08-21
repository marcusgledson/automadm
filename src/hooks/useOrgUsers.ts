import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useUserRole";

export interface OrgUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  gender: string | null;
  phone_country_code: string | null;
  phone_area_code: string | null;
  phone_number: string | null;
  phone_is_whatsapp: boolean;
  must_change_password: boolean;
  allowed_modules: string[];
  created_at: string;
  role: AppRole;
  is_self: boolean;
}

export interface NewOrgUser {
  email: string;
  full_name: string;
  role: AppRole;
  gender?: string | null;
  phone_country_code?: string | null;
  phone_area_code?: string | null;
  phone_number?: string | null;
  phone_is_whatsapp?: boolean;
  allowed_modules: string[];
}

async function call<T>(body: Record<string, unknown>): Promise<{ ok: boolean; data?: T; error?: string }> {
  const { data, error } = await supabase.functions.invoke("manage-org-users", { body });
  if (error) {
    const msg = (data as { error?: string } | null)?.error || error.message;
    return { ok: false, error: msg };
  }
  if ((data as { error?: string })?.error) return { ok: false, error: (data as { error: string }).error };
  return { ok: true, data: data as T };
}

export function useOrgUsers(enabled: boolean) {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await call<{ users: OrgUser[] }>({ action: "list" });
    if (!res.ok) setError(res.error ?? "Falha ao carregar usuários.");
    else {
      setError(null);
      setUsers(res.data?.users ?? []);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createUser = useCallback(
    async (payload: NewOrgUser) => {
      const res = await call<{ temp_password: string }>({ action: "create", ...payload });
      if (res.ok) await refresh();
      return res;
    },
    [refresh],
  );

  const resetPassword = useCallback(async (user_id: string) => {
    return call<{ temp_password: string }>({ action: "reset_password", user_id });
  }, []);

  const deleteUser = useCallback(
    async (user_id: string) => {
      const res = await call({ action: "delete", user_id });
      if (res.ok) await refresh();
      return res;
    },
    [refresh],
  );

  /** Atualiza perfil e módulos via RLS (Máster já tem permissão nas tabelas) e registra auditoria. */
  const updateUser = useCallback(
    async (user_id: string, patch: { role?: AppRole; allowed_modules?: string[]; full_name?: string | null }) => {
      if (patch.allowed_modules || patch.full_name !== undefined) {
        const { error } = await supabase
          .from("profiles")
          .update({
            ...(patch.allowed_modules ? { allowed_modules: patch.allowed_modules } : {}),
            ...(patch.full_name !== undefined ? { full_name: patch.full_name } : {}),
          })
          .eq("user_id", user_id);
        if (error) return { ok: false, error: error.message };
        await call({
          action: "log",
          user_id,
          log_action: patch.allowed_modules ? "update_modules" : "update_profile",
          details: patch.allowed_modules ? { allowed_modules: patch.allowed_modules } : { full_name: patch.full_name },
        });
      }
      if (patch.role) {
        const { error } = await supabase.from("user_roles").update({ role: patch.role }).eq("user_id", user_id);
        if (error) return { ok: false, error: error.message };
        await call({ action: "log", user_id, log_action: "update_role", details: { role: patch.role } });
      }
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  return { users, loading, error, refresh, createUser, updateUser, deleteUser, resetPassword };
}
