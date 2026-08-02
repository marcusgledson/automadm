import { supabase } from "@/integrations/supabase/client";

export type ImpactTableKey =
  | "bank_statements"
  | "consumption_bills"
  | "expenses"
  | "drive_links"
  | "sms_bank_configs"
  | "sms_review_queue";

export interface ImpactRowPreview {
  id: string;
  primary: string;
  secondary: string;
  value?: string;
}

export interface ImpactGroup {
  key: ImpactTableKey;
  label: string;
  count: number;
  rows: ImpactRowPreview[];
  /** true when this group is only deleted as a consequence of the target */
  dependent: boolean;
  reason?: string;
}

export interface ImpactPlan {
  targetLabel: string;
  /** all tables that will actually be deleted, in safe order */
  order: ImpactTableKey[];
  groups: ImpactGroup[];
  totalRows: number;
  hasDependents: boolean;
}

export const IMPACT_LABELS: Record<ImpactTableKey, string> = {
  bank_statements: "Extratos Bancários",
  consumption_bills: "Faturas / Contas de Consumo",
  expenses: "Despesas / Boletos",
  drive_links: "Links do Google Drive",
  sms_bank_configs: "Bancos configurados (SMS)",
  sms_review_queue: "Fila de revisão de SMS",
};

const PREVIEW_LIMIT = 50;

const fmtBRL = (v: number | null | undefined) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function mapPreview(key: ImpactTableKey, r: Record<string, unknown>): ImpactRowPreview {
  switch (key) {
    case "bank_statements":
      return {
        id: String(r.id),
        primary: `${r.data_raw || r.data || "—"} · ${r.descricao || r.lancamento || "—"}`,
        secondary: `Ag ${r.agencia || "—"} / Cc ${r.conta || "—"}`,
        value: fmtBRL(r.valor as number),
      };
    case "consumption_bills":
      return {
        id: String(r.id),
        primary: `${r.tipo_conta || "conta"} · ${r.codigo_instalacao || "—"}`,
        secondary: `Venc. ${r.data_vencimento || "—"}${r.fornecedor ? ` · ${r.fornecedor}` : ""}`,
        value: fmtBRL(r.valor_total as number),
      };
    case "expenses":
      return {
        id: String(r.id),
        primary: `${r.detalhes || r.categoria || "Lançamento"}`,
        secondary: `${r.origem || "manual"} · ${r.data_vencimento || r.data_pagamento || "—"}`,
        value: fmtBRL(r.valor as number),
      };
    case "drive_links":
      return { id: String(r.id), primary: String(r.label || "Link"), secondary: String(r.url || "") };
    case "sms_bank_configs":
      return {
        id: String(r.id),
        primary: String(r.bank_name || "Banco"),
        secondary: `Ag ${r.agencia || "—"} / Cc ${r.conta || "—"}`,
      };
    case "sms_review_queue":
      return {
        id: String(r.id),
        primary: String(r.descricao || r.raw_message || "").slice(0, 80),
        secondary: `${r.bank_name || r.sender || "—"} · ${r.status}`,
        value: fmtBRL(r.amount as number),
      };
  }
}

async function loadGroup(
  key: ImpactTableKey,
  userId: string,
  dependent: boolean,
  reason?: string,
  filter?: (q: LooseQuery) => LooseQuery,
): Promise<ImpactGroup> {
  let q = buildQuery(key, userId);
  if (filter) q = filter(q);
  const { data, count } = await q.limit(PREVIEW_LIMIT);
  const rows = (data ?? []).map((r) => mapPreview(key, r as Record<string, unknown>));
  return { key, label: IMPACT_LABELS[key], count: count ?? rows.length, rows, dependent, reason };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseQuery = any;

function buildQuery(key: ImpactTableKey, userId: string): LooseQuery {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from(key) as any).select("*", { count: "exact" }).eq("user_id", userId);
}

/**
 * Monta o plano de exclusão com toda a cadeia de dependências lógicas.
 * - bank_statements → despesas replicadas do OFX (origem = 'ofx')
 * - consumption_bills → despesas geradas por faturas (origem = 'fatura')
 * - sms_bank_configs → fila de revisão de SMS (FK real) e despesas de SMS
 */
export async function buildImpactPlan(
  target: ImpactTableKey | "all",
  userId: string,
): Promise<ImpactPlan> {
  if (target === "all") {
    const keys: ImpactTableKey[] = [
      "sms_review_queue",
      "sms_bank_configs",
      "expenses",
      "bank_statements",
      "consumption_bills",
      "drive_links",
    ];
    const groups = await Promise.all(keys.map((k) => loadGroup(k, userId, false)));
    return {
      targetLabel: "Toda a base",
      order: keys,
      groups,
      totalRows: groups.reduce((s, g) => s + g.count, 0),
      hasDependents: true,
    };
  }

  const groups: ImpactGroup[] = [loadPlaceholder(target)];
  groups[0] = await loadGroup(target, userId, false);

  if (target === "bank_statements") {
    const dep = await loadGroup(
      "expenses",
      userId,
      true,
      "Despesas replicadas automaticamente dos lançamentos de débito do OFX.",
      (q) => q.eq("origem", "ofx"),
    );
    if (dep.count > 0) groups.push(dep);
  }

  if (target === "consumption_bills") {
    const dep = await loadGroup(
      "expenses",
      userId,
      true,
      "Despesas geradas a partir das faturas de consumo.",
      (q) => q.eq("origem", "fatura"),
    );
    if (dep.count > 0) groups.push(dep);
  }

  if (target === "sms_bank_configs") {
    const fila = await loadGroup(
      "sms_review_queue",
      userId,
      true,
      "A fila de revisão referencia os bancos configurados (chave estrangeira).",
    );
    if (fila.count > 0) groups.push(fila);
    const dep = await loadGroup(
      "expenses",
      userId,
      true,
      "Despesas aprovadas a partir de SMS desses bancos.",
      (q) => q.eq("origem", "sms"),
    );
    if (dep.count > 0) groups.push(dep);
  }

  const dependents = groups.filter((g) => g.dependent);
  // dependentes sempre são apagados antes do alvo
  const order = [...dependents.map((g) => g.key), target];

  return {
    targetLabel: IMPACT_LABELS[target],
    order: Array.from(new Set(order)),
    groups,
    totalRows: groups.reduce((s, g) => s + g.count, 0),
    hasDependents: dependents.length > 0,
  };
}

function loadPlaceholder(key: ImpactTableKey): ImpactGroup {
  return { key, label: IMPACT_LABELS[key], count: 0, rows: [], dependent: false };
}

/** Executa o plano respeitando a ordem (filhos → pai). */
export async function executeImpactPlan(plan: ImpactPlan, userId: string): Promise<void> {
  for (const key of plan.order) {
    const group = plan.groups.find((g) => g.key === key && g.dependent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: LooseQuery = (supabase.from(key) as any).delete().eq("user_id", userId);
    if (group) {
      if (key === "expenses") {
        const origem =
          group.reason?.includes("OFX") ? "ofx" : group.reason?.includes("SMS") ? "sms" : "fatura";
        q = q.eq("origem", origem);
      }
    }
    const { error } = await q;
    if (error) throw new Error(`${IMPACT_LABELS[key]}: ${error.message}`);
  }
}
