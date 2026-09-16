import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export type RequestStatus = "pendente" | "aprovada" | "recusada";

export interface ReportRequest {
  id: string;
  requester_id: string;
  org_owner_id: string;
  modulo: string;
  formato: string;
  justificativa: string | null;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export const REPORT_FORMATS = [
  { id: "pdf", label: "PDF" },
  { id: "xlsx", label: "Planilha (XLSX)" },
  { id: "csv", label: "CSV" },
  { id: "json", label: "Backup JSON" },
] as const;

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  recusada: "Recusada",
};

/**
 * Solicitações de relatório: Colaborador/Leitor pedem, Máster decide.
 * A RLS entrega ao Máster os pedidos da própria organização e ao autor os seus.
 */
export function useReportRequests() {
  const { user } = useAuth();
  const { isMaster, orgOwnerId } = useUserRole();
  const [requests, setRequests] = useState<ReportRequest[]>([]);
  const [requesters, setRequesters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setRequesters({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("report_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data as ReportRequest[]) ?? [];
    setRequests(rows);

    const ids = Array.from(new Set(rows.map((r) => r.requester_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, full_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      for (const p of profs ?? []) {
        map[p.user_id] = p.full_name || p.display_name || "";
      }
      setRequesters(map);
    } else {
      setRequesters({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: { modulo: string; formato: string; justificativa: string | null }) => {
      if (!user) return { ok: false as const, error: "Sessão expirada." };
      const { error } = await supabase.from("report_requests").insert({
        requester_id: user.id,
        org_owner_id: orgOwnerId ?? user.id,
        modulo: input.modulo,
        formato: input.formato,
        justificativa: input.justificativa,
      });
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [user, orgOwnerId, refresh],
  );

  const decide = useCallback(
    async (id: string, status: Exclude<RequestStatus, "pendente">) => {
      if (!user) return { ok: false as const, error: "Sessão expirada." };
      const { error } = await supabase
        .from("report_requests")
        .update({ status, decided_by: user.id, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [user, refresh],
  );

  const mine = useMemo(
    () => requests.filter((r) => r.requester_id === user?.id),
    [requests, user],
  );
  const inbox = useMemo(
    () => (isMaster ? requests.filter((r) => r.requester_id !== user?.id) : []),
    [requests, isMaster, user],
  );
  const pendingCount = useMemo(
    () => inbox.filter((r) => r.status === "pendente").length,
    [inbox],
  );

  /** Um módulo/formato liberado para exportação pelo perfil não-Máster. */
  const isApproved = useCallback(
    (modulo: string) =>
      mine.some((r) => r.modulo === modulo && r.status === "aprovada"),
    [mine],
  );

  return { requests, mine, inbox, pendingCount, loading, refresh, create, decide, isApproved };
}
