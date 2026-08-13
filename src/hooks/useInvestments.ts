import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type InvestmentSource = "upload" | "manual" | "drive";

export interface Investment {
  id: string;
  user_id: string;
  instituicao: string;
  tipo_investimento: string;
  ativo: string;
  valor_aplicado: number | null;
  valor_bruto: number | null;
  valor_liquido: number | null;
  rendimento: number | null;
  data_aplicacao: string;
  data_vencimento: string | null;
  data_carencia: string | null;
  liquidez: string | null;
  indexador: string | null;
  percentual_indexador: number | null;
  taxa_contratada: string | null;
  rentabilidade_periodo: number | null;
  ir: number | null;
  iof: number | null;
  quantidade: number | null;
  preco_unitario: number | null;
  observacoes: string | null;
  explicacao: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
  file_name: string | null;
  source: InvestmentSource;
  created_at: string;
  updated_at: string;
}

export type NewInvestmentInput = Omit<
  Investment,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export const INVESTMENT_DUPLICATE_MESSAGE =
  "Investimento com mesma Instituição, Ativo e Data de Aplicação já está na base";

export function useInvestments() {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .order("data_aplicacao", { ascending: false });
    if (!error && data) setInvestments(data as unknown as Investment[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /** Insere ou atualiza usando (user_id, instituicao, ativo, data_aplicacao) como chave. */
  const upsertInvestment = useCallback(
    async (inv: NewInvestmentInput): Promise<{ ok: boolean; error?: string; data?: Investment }> => {
      if (!user) return { ok: false, error: "Usuário não autenticado" };
      const payload = { ...inv, user_id: user.id, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("investments")
        .upsert(payload as never, { onConflict: "user_id,instituicao,ativo,data_aplicacao" })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      const row = data as unknown as Investment;
      setInvestments((prev) =>
        [...prev.filter((x) => x.id !== row.id), row].sort((a, b) =>
          b.data_aplicacao.localeCompare(a.data_aplicacao)
        )
      );
      return { ok: true, data: row };
    },
    [user]
  );

  const deleteInvestment = useCallback(async (id: string) => {
    const { error } = await supabase.from("investments").delete().eq("id", id);
    if (!error) setInvestments((prev) => prev.filter((i) => i.id !== id));
    return !error;
  }, []);

  const deleteMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return true;
    const { error } = await supabase.from("investments").delete().in("id", ids);
    if (!error) setInvestments((prev) => prev.filter((i) => !ids.includes(i.id)));
    return !error;
  }, []);

  return { investments, loading, fetchAll, upsertInvestment, deleteInvestment, deleteMany };
}
