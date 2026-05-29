import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { FinancialRecord } from "@/lib/fileParser";

export interface ExpenseRow {
  id: string;
  user_id: string;
  tipo_lancamento: string;
  categoria: string | null;
  numero_documento: string | null;
  detalhes: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  origem: string;
  source_ref: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type NewExpense = Omit<ExpenseRow, "id" | "user_id" | "created_at" | "updated_at">;

function brToISO(d: string): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function debitFromOFX(r: FinancialRecord, accountRef: string): NewExpense {
  const iso = brToISO(r.data);
  return {
    tipo_lancamento: r.lancamento || "Débito",
    categoria: r.categoria || "Outros",
    numero_documento: r.documento || r.codigoOperacao || null,
    detalhes: r.descricao || null,
    valor: Math.abs(r.valor),
    data_vencimento: iso,
    data_pagamento: iso,
    origem: "ofx",
    source_ref: `${accountRef}|${r.fitid || r.documento || `${r.data}-${r.valor}`}`,
    raw: r.raw ?? {},
  };
}

export function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("data_vencimento", { ascending: true });
    if (!error && data) setExpenses(data as unknown as ExpenseRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const insertOne = useCallback(async (e: NewExpense) => {
    if (!user) return { ok: false, error: "Não autenticado" };
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...e, user_id: user.id } as never)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    setExpenses((prev) => [...prev, data as unknown as ExpenseRow]
      .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? "")));
    return { ok: true };
  }, [user]);

  const upsertManyFromOFX = useCallback(async (
    records: FinancialRecord[],
    accountRef: string,
  ): Promise<{ ok: boolean; count: number; error?: string }> => {
    if (!user) return { ok: false, count: 0, error: "Não autenticado" };
    const debits = records
      .filter((r) => r.tipo === "Débito")
      .map((r) => ({ ...debitFromOFX(r, accountRef), user_id: user.id }));
    if (debits.length === 0) return { ok: true, count: 0 };
    const { error, count } = await supabase
      .from("expenses")
      .upsert(debits as never, { onConflict: "user_id,source_ref", count: "exact" });
    if (error) return { ok: false, count: 0, error: error.message };
    await fetchAll();
    return { ok: true, count: count ?? debits.length };
  }, [user, fetchAll]);

  const deleteMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return true;
    const { error } = await supabase.from("expenses").delete().in("id", ids);
    if (!error) setExpenses((prev) => prev.filter((e) => !ids.includes(e.id)));
    return !error;
  }, []);

  return { expenses, loading, fetchAll, insertOne, upsertManyFromOFX, deleteMany };
}
