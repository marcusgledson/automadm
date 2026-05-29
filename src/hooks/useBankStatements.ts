import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { FinancialRecord } from "@/lib/fileParser";

export interface BankStatementRow {
  id: string;
  user_id: string;
  agencia: string;
  conta: string;
  banco: string | null;
  fitid: string;
  data: string | null;
  data_raw: string | null;
  lancamento: string | null;
  descricao: string | null;
  valor: number;
  tipo: string | null;
  tipo_lancamento: string | null;
  categoria: string | null;
  documento: string | null;
  codigo_operacao: string | null;
  raw: Record<string, unknown> | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Converts dd/mm/yyyy → yyyy-mm-dd; returns null on bad input. */
function brToISO(d: string): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export interface UpsertContext {
  agencia: string;
  conta: string;
  banco?: string;
  fileName?: string;
}

export function recordToRow(
  r: FinancialRecord,
  ctx: UpsertContext,
  userId: string,
): Omit<BankStatementRow, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    agencia: ctx.agencia || "",
    conta: ctx.conta || "",
    banco: ctx.banco ?? null,
    fitid: r.fitid || r.documento || `${r.data}|${r.valor}|${r.descricao}`.slice(0, 80),
    data: brToISO(r.data),
    data_raw: r.data,
    lancamento: r.lancamento,
    descricao: r.descricao,
    valor: r.valor,
    tipo: r.tipo,
    tipo_lancamento: r.tipoLancamento,
    categoria: r.categoria,
    documento: r.documento ?? null,
    codigo_operacao: r.codigoOperacao ?? null,
    raw: r.raw ?? {},
    file_name: ctx.fileName ?? null,
  };
}

export function useBankStatements() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BankStatementRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_statements")
      .select("*")
      .order("data", { ascending: true });
    if (!error && data) setRows(data as unknown as BankStatementRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertMany = useCallback(
    async (records: FinancialRecord[], ctx: UpsertContext): Promise<{ ok: boolean; count: number; error?: string }> => {
      if (!user) return { ok: false, count: 0, error: "Não autenticado" };
      if (!ctx.agencia || !ctx.conta) {
        return { ok: false, count: 0, error: "Agência/Conta não encontrados no OFX." };
      }
      const payload = records.map((r) => recordToRow(r, ctx, user.id));
      const { error, count } = await supabase
        .from("bank_statements")
        .upsert(payload as never, {
          onConflict: "user_id,agencia,conta,fitid",
          count: "exact",
        });
      if (error) return { ok: false, count: 0, error: error.message };
      await fetchAll();
      return { ok: true, count: count ?? payload.length };
    },
    [user, fetchAll],
  );

  return { rows, loading, fetchAll, upsertMany };
}
