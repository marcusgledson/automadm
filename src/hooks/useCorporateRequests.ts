import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RequestStatus } from "@/hooks/useReportRequests";

export interface CorporateRequest {
  id: string;
  user_id: string | null;
  nome_solicitante: string;
  email: string;
  empresa: string | null;
  demanda: string;
  modulos_desejados: string[];
  status: RequestStatus;
  created_at: string;
}

/** Demandas corporativas (novos módulos/recursos) enviadas ao desenvolvedor. */
export function useCorporateRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CorporateRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("corporate_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data as CorporateRequest[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: {
      nome_solicitante: string;
      email: string;
      empresa: string | null;
      demanda: string;
      modulos_desejados: string[];
    }) => {
      if (!user) return { ok: false as const, error: "Sessão expirada." };
      const { error } = await supabase.from("corporate_requests").insert({
        user_id: user.id,
        ...input,
      });
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("corporate_requests").delete().eq("id", id);
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  return { requests, loading, refresh, create, remove };
}
