import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type BillType =
  | "energia" | "internet" | "agua" | "iptu" | "ipva" | "taxa" | "gas" | "telefone" | "outro";

export type BillSource = "drive" | "upload" | "manual";

export interface ConsumptionBill {
  id: string;
  user_id: string;
  tipo_conta: BillType;
  fornecedor: string | null;
  codigo_instalacao: string;
  titular: string | null;
  cpf_cnpj: string | null;
  endereco: string | null;
  mes_referencia: string | null;
  data_vencimento: string; // YYYY-MM-DD
  valor_total: number | null;
  consumo: number | null;
  unidade_consumo: string | null;
  impostos: Record<string, number> | null;
  itens: Array<Record<string, unknown>> | null;
  historico: Array<Record<string, unknown>> | null;
  raw_data: Record<string, unknown> | null;
  file_name: string | null;
  source: BillSource;
  created_at: string;
  updated_at: string;
}

export type NewBillInput = Omit<ConsumptionBill, "id" | "user_id" | "created_at" | "updated_at">;

export const DUPLICATE_MESSAGE =
  "Fatura com Código Instalação e Data Vencimento já carregados na Base";

export function isDuplicateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /duplicate key|consumption_bills_unique_key|23505/i.test(msg);
}

export function useConsumptionBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState<ConsumptionBill[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("consumption_bills")
      .select("*")
      .order("data_vencimento", { ascending: true });
    if (!error && data) setBills(data as unknown as ConsumptionBill[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const insertBill = useCallback(async (b: NewBillInput): Promise<{ ok: boolean; duplicate?: boolean; error?: string; data?: ConsumptionBill }> => {
    if (!user) return { ok: false, error: "Usuário não autenticado" };
    const payload = { ...b, user_id: user.id };
    const { data, error } = await supabase
      .from("consumption_bills")
      .insert(payload as never)
      .select()
      .single();
    if (error) {
      if (isDuplicateError(error)) return { ok: false, duplicate: true, error: DUPLICATE_MESSAGE };
      return { ok: false, error: error.message };
    }
    setBills((prev) => [...prev, data as unknown as ConsumptionBill]
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)));
    return { ok: true, data: data as unknown as ConsumptionBill };
  }, [user]);

  const deleteBill = useCallback(async (id: string) => {
    const { error } = await supabase.from("consumption_bills").delete().eq("id", id);
    if (!error) setBills((prev) => prev.filter((b) => b.id !== id));
    return !error;
  }, []);

  const deleteMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return true;
    const { error } = await supabase.from("consumption_bills").delete().in("id", ids);
    if (!error) setBills((prev) => prev.filter((b) => !ids.includes(b.id)));
    return !error;
  }, []);

  return { bills, loading, fetchAll, insertBill, deleteBill, deleteMany };
}
