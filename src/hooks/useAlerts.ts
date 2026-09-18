import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useBudgetGoals } from "@/hooks/useBudgetGoals";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AppAlert {
  id: string;
  title: string;
  description: string;
  count: number;
  severity: AlertSeverity;
  actionLabel: string;
  path: string;
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Agrega pendências de metas, validações, importações e solicitações. */
export function useAlerts() {
  const { user } = useAuth();
  const { isMaster } = useUserRole();
  const { canAccess } = useModuleAccess();
  const { progress, loading: goalsLoading } = useBudgetGoals();

  const [smsPending, setSmsPending] = useState(0);
  const [billsDue, setBillsDue] = useState(0);
  const [billsIncomplete, setBillsIncomplete] = useState(0);
  const [orgPending, setOrgPending] = useState(0);
  const [reportsPending, setReportsPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const head = { count: "exact" as const, head: true };
    const [sms, due, incomplete, orgReq, reports] = await Promise.all([
      supabase.from("sms_review_queue").select("id", head).eq("status", "pending"),
      supabase
        .from("consumption_bills")
        .select("id", head)
        .gte("data_vencimento", todayISO(-30))
        .lte("data_vencimento", todayISO(7)),
      supabase.from("consumption_bills").select("id", head).is("valor_total", null),
      isMaster
        ? supabase.from("org_access_requests").select("id", head).eq("status", "pendente")
        : Promise.resolve({ count: 0 }),
      isMaster
        ? supabase.from("report_requests").select("id", head).eq("status", "pendente")
        : Promise.resolve({ count: 0 }),
    ]);

    setSmsPending(sms.count ?? 0);
    setBillsDue(due.count ?? 0);
    setBillsIncomplete(incomplete.count ?? 0);
    setOrgPending(orgReq.count ?? 0);
    setReportsPending(reports.count ?? 0);
    setLoading(false);
  }, [user, isMaster]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const alerts = useMemo<AppAlert[]>(() => {
    const list: AppAlert[] = [];

    if (canAccess("metas")) {
      const estourou = progress.filter((p) => p.estourou);
      const emAlerta = progress.filter((p) => !p.estourou && p.emAlerta);
      if (estourou.length > 0) {
        list.push({
          id: "metas-estouradas",
          title: "Orçamento ultrapassado",
          description: `${estourou.length} meta(s) com custo acima do orçado: ${estourou
            .map((p) => p.goal.titulo)
            .join(", ")}.`,
          count: estourou.length,
          severity: "critical",
          actionLabel: "Ver metas",
          path: "/metas",
        });
      }
      if (emAlerta.length > 0) {
        list.push({
          id: "metas-alerta",
          title: "Metas próximas do limite",
          description: `${emAlerta.length} meta(s) atingiram o percentual de alerta definido.`,
          count: emAlerta.length,
          severity: "warning",
          actionLabel: "Ver metas",
          path: "/metas",
        });
      }
    }

    if (smsPending > 0) {
      list.push({
        id: "sms-pendentes",
        title: "Validações pendentes",
        description: `${smsPending} mensagem(ns) de banco aguardando sua conferência.`,
        count: smsPending,
        severity: "warning",
        actionLabel: "Revisar",
        path: "/sms/revisao",
      });
    }

    if (canAccess("contas")) {
      if (billsIncomplete > 0) {
        list.push({
          id: "contas-incompletas",
          title: "Importações para conferir",
          description: `${billsIncomplete} conta(s) importada(s) sem valor lido — confira os campos.`,
          count: billsIncomplete,
          severity: "warning",
          actionLabel: "Abrir Central de Contas",
          path: "/contas",
        });
      }
      if (billsDue > 0) {
        list.push({
          id: "contas-vencendo",
          title: "Contas a vencer",
          description: `${billsDue} conta(s) vencem nos próximos 7 dias ou venceram há menos de 30 dias.`,
          count: billsDue,
          severity: "info",
          actionLabel: "Abrir Central de Contas",
          path: "/contas",
        });
      }
    }

    const solicitacoes = orgPending + reportsPending;
    if (solicitacoes > 0) {
      list.push({
        id: "solicitacoes",
        title: "Solicitações pendentes",
        description: `${orgPending} pedido(s) de acesso e ${reportsPending} pedido(s) de relatório aguardando decisão.`,
        count: solicitacoes,
        severity: "info",
        actionLabel: "Abrir solicitações",
        path: "/solicitacoes",
      });
    }

    return list;
  }, [progress, smsPending, billsDue, billsIncomplete, orgPending, reportsPending, canAccess]);

  return { alerts, loading: loading || goalsLoading, refresh };
}
