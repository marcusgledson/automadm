import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/hooks/useUserRole";

export interface OrgRequest {
  id: string;
  organization_id: string;
  requester_id: string;
  requester_email: string | null;
  requester_name: string | null;
  requested_role: AppRole;
  status: "pendente" | "aprovada" | "recusada";
  created_at: string;
}

/** Pedidos de acesso à empresa — visíveis ao Máster (dono) via RLS. */
export function useOrgRequests(enabled: boolean) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OrgRequest[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled || !user) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("org_access_requests")
      .select("*")
      .eq("status", "pendente")
      .neq("requester_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((data as OrgRequest[]) ?? []);
    setLoading(false);
  }, [enabled, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const approve = useCallback(
    async (id: string, role: AppRole, modules: string[]) => {
      const { error } = await supabase.rpc("approve_org_request", {
        _request_id: id,
        _role: role,
        _modules: modules,
      });
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  const reject = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("reject_org_request", { _request_id: id });
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  return { requests, loading, refresh, approve, reject };
}
