import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BANK_PRESETS } from "@/lib/smsParser";
import { toast } from "@/hooks/use-toast";

export interface SmsBankConfigRow {
  id: string;
  user_id: string;
  bank_name: string;
  senders: string[];
  debit_keywords: string[];
  credit_keywords: string[];
  amount_regex: string | null;
  agencia: string | null;
  conta: string | null;
  is_active: boolean;
  is_preset: boolean;
}

export function useSmsBankConfigs() {
  const { user } = useAuth();
  const [items, setItems] = useState<SmsBankConfigRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("sms_bank_configs")
      .select("*")
      .order("bank_name", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar bancos", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as SmsBankConfigRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const upsert = useCallback(async (row: Partial<SmsBankConfigRow> & { bank_name: string }) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      bank_name: row.bank_name,
      senders: row.senders ?? [],
      debit_keywords: row.debit_keywords ?? [],
      credit_keywords: row.credit_keywords ?? [],
      amount_regex: row.amount_regex ?? null,
      agencia: row.agencia ?? null,
      conta: row.conta ?? null,
      is_active: row.is_active ?? true,
      is_preset: row.is_preset ?? false,
    };
    const { error } = await supabase
      .from("sms_bank_configs")
      .upsert(payload, { onConflict: "user_id,bank_name" });
    if (error) {
      toast({ title: "Erro ao salvar banco", description: error.message, variant: "destructive" });
      return false;
    }
    await refresh();
    return true;
  }, [user, refresh]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("sms_bank_configs").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    await refresh();
    return true;
  }, [refresh]);

  const loadPresets = useCallback(async () => {
    if (!user) return;
    const rows = BANK_PRESETS.map((p) => ({
      user_id: user.id,
      bank_name: p.bank_name,
      senders: p.senders,
      debit_keywords: p.debit_keywords,
      credit_keywords: p.credit_keywords,
      amount_regex: p.amount_regex ?? null,
      is_active: true,
      is_preset: true,
    }));
    const { error } = await supabase
      .from("sms_bank_configs")
      .upsert(rows, { onConflict: "user_id,bank_name" });
    if (error) {
      toast({ title: "Erro ao carregar presets", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Presets carregados", description: `${rows.length} bancos disponíveis.` });
    await refresh();
  }, [user, refresh]);

  return { items, loading, refresh, upsert, remove, loadPresets };
}
