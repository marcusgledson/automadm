import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type GoalStatus = "ativa" | "concluida" | "arquivada";

export interface BudgetGoal {
  id: string;
  titulo: string;
  escopo: string;
  referencia: string | null;
  valor_orcado: number;
  meta_economia: number;
  prazo: string | null;
  alerta_percentual: number;
  notificar: boolean;
  status: GoalStatus;
  observacoes: string | null;
  created_at: string;
}

export type GoalInput = Omit<BudgetGoal, "id" | "created_at">;

/** Escopos de consumo/indicação que podem ser orçados. */
export const GOAL_SCOPES = [
  { id: "energia", label: "Energia elétrica", source: "bills" as const, tipo: "energia" },
  { id: "agua", label: "Água", source: "bills" as const, tipo: "agua" },
  { id: "internet", label: "Internet", source: "bills" as const, tipo: "internet" },
  { id: "gas", label: "Gás", source: "bills" as const, tipo: "gas" },
  { id: "telefone", label: "Telefone", source: "bills" as const, tipo: "telefone" },
  { id: "iptu", label: "IPTU", source: "bills" as const, tipo: "iptu" },
  { id: "ipva", label: "IPVA", source: "bills" as const, tipo: "ipva" },
  { id: "taxa", label: "Taxas", source: "bills" as const, tipo: "taxa" },
  { id: "despesas", label: "Despesas gerais (categoria livre)", source: "expenses" as const, tipo: null },
  { id: "extrato", label: "Débitos do extrato bancário", source: "statements" as const, tipo: null },
];

export interface GoalProgress {
  goal: BudgetGoal;
  realizado: number;
  restante: number;
  percentual: number;
  estourou: boolean;
  emAlerta: boolean;
  diasRestantes: number | null;
  economiaProjetada: number;
}

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function useBudgetGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [realized, setRealized] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: goalRows }, { data: bills }, { data: expenses }, { data: statements }] =
      await Promise.all([
        supabase.from("budget_goals").select("*").order("created_at", { ascending: false }),
        supabase
          .from("consumption_bills")
          .select("tipo_conta,valor_total,data_vencimento")
          .gte("data_vencimento", monthStart()),
        supabase
          .from("expenses")
          .select("categoria,valor,tipo_lancamento,data_vencimento")
          .gte("data_vencimento", monthStart()),
        supabase.from("bank_statements").select("valor,tipo_lancamento,data").gte("data", monthStart()),
      ]);

    const acc: Record<string, number> = {};
    for (const b of bills ?? []) {
      const k = String(b.tipo_conta ?? "outro");
      acc[`bills:${k}`] = (acc[`bills:${k}`] ?? 0) + Number(b.valor_total ?? 0);
    }
    for (const e of expenses ?? []) {
      const cat = (e.categoria ?? "").trim().toLowerCase();
      const v = Math.abs(Number(e.valor ?? 0));
      acc["expenses:*"] = (acc["expenses:*"] ?? 0) + v;
      if (cat) acc[`expenses:${cat}`] = (acc[`expenses:${cat}`] ?? 0) + v;
    }
    for (const s of statements ?? []) {
      const isDebit = String(s.tipo_lancamento ?? "").toLowerCase().startsWith("d") || Number(s.valor) < 0;
      if (isDebit) acc["statements:*"] = (acc["statements:*"] ?? 0) + Math.abs(Number(s.valor ?? 0));
    }

    setRealized(acc);
    setGoals((goalRows as BudgetGoal[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const realizadoFor = useCallback(
    (goal: BudgetGoal) => {
      const scope = GOAL_SCOPES.find((s) => s.id === goal.escopo);
      if (!scope) return 0;
      if (scope.source === "bills") return realized[`bills:${scope.tipo}`] ?? 0;
      if (scope.source === "statements") return realized["statements:*"] ?? 0;
      const ref = (goal.referencia ?? "").trim().toLowerCase();
      return ref ? (realized[`expenses:${ref}`] ?? 0) : (realized["expenses:*"] ?? 0);
    },
    [realized],
  );

  const progress = useMemo<GoalProgress[]>(
    () =>
      goals.map((goal) => {
        const realizadoValor = realizadoFor(goal);
        const orcado = Number(goal.valor_orcado) || 0;
        const percentual = orcado > 0 ? (realizadoValor / orcado) * 100 : 0;
        const diasRestantes = goal.prazo
          ? Math.ceil((new Date(goal.prazo).getTime() - Date.now()) / 86_400_000)
          : null;
        return {
          goal,
          realizado: realizadoValor,
          restante: orcado - realizadoValor,
          percentual,
          estourou: orcado > 0 && realizadoValor > orcado,
          emAlerta: orcado > 0 && percentual >= Number(goal.alerta_percentual || 100),
          diasRestantes,
          economiaProjetada: orcado - realizadoValor - Number(goal.meta_economia || 0),
        };
      }),
    [goals, realizadoFor],
  );

  const upsertGoal = useCallback(
    async (input: Partial<GoalInput> & { id?: string }) => {
      if (!user) return { ok: false, error: "Não autenticado" };
      const payload = { ...input, user_id: user.id };
      const { error } = await supabase.from("budget_goals").upsert(payload as never);
      if (error) return { ok: false, error: error.message };
      await refresh();
      return { ok: true };
    },
    [user, refresh],
  );

  const removeGoal = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("budget_goals").delete().eq("id", id);
      if (error) return { ok: false, error: error.message };
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  return { goals, progress, loading, refresh, upsertGoal, removeGoal };
}
