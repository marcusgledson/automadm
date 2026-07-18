import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface SmsReviewRow {
  id: string;
  user_id: string;
  bank_config_id: string | null;
  bank_name: string | null;
  sender: string | null;
  raw_message: string;
  received_at: string | null;
  kind: "debit" | "credit" | "unknown";
  amount: number | null;
  descricao: string | null;
  agencia: string | null;
  conta: string | null;
  status: "pending" | "approved" | "rejected";
  target_ref: string | null;
}

export function useSmsReviewQueue() {
  const { user } = useAuth();
  const [items, setItems] = useState<SmsReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("sms_review_queue")
      .select("*")
      .order("received_at", { ascending: false, nullsFirst: false });
    if (error) toast({ title: "Erro ao carregar fila", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as SmsReviewRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const insertMany = useCallback(async (rows: Omit<SmsReviewRow, "id" | "user_id" | "status" | "target_ref">[]) => {
    if (!user) return;
    const payload = rows.map((r) => ({ ...r, user_id: user.id, status: "pending" as const }));
    const { error } = await supabase.from("sms_review_queue").insert(payload);
    if (error) toast({ title: "Erro ao inserir SMS", description: error.message, variant: "destructive" });
    else await refresh();
  }, [user, refresh]);

  const update = useCallback(async (id: string, patch: Partial<SmsReviewRow>) => {
    const { error } = await supabase.from("sms_review_queue").update(patch).eq("id", id);
    if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    else await refresh();
  }, [refresh]);

  const reject = useCallback(async (ids: string[]) => {
    const { error } = await supabase
      .from("sms_review_queue")
      .update({ status: "rejected" })
      .in("id", ids);
    if (error) toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    else await refresh();
  }, [refresh]);

  const approve = useCallback(async (rows: SmsReviewRow[]) => {
    if (!user) return { ok: 0, fail: 0 };
    let ok = 0, fail = 0;
    for (const r of rows) {
      if (!r.amount || r.kind === "unknown") { fail++; continue; }
      const dt = r.received_at ? new Date(r.received_at) : new Date();
      const iso = dt.toISOString().slice(0, 10);
      try {
        if (r.kind === "debit") {
          const { error } = await (supabase.from("expenses") as any).insert({
            user_id: user.id,
            valor: r.amount,
            data_pagamento: iso,
            data_vencimento: iso,
            detalhes: r.descricao ?? r.raw_message.slice(0, 120),
            categoria: r.bank_name ?? "SMS",
            origem: "sms",
            tipo_lancamento: "debito",
            source_ref: `sms:${r.id}`,
            raw: r as unknown as Record<string, unknown>,
          });
          if (error) throw error;
        } else {
          // credit
          const agencia = r.agencia ?? "SMS";
          const conta = r.conta ?? "SMS";
          const fitid = `SMS-${r.id}`;
          const { error } = await supabase.from("bank_statements").insert({
            user_id: user.id,
            fitid,
            agencia,
            conta,
            banco: r.bank_name,
            data: iso,
            data_raw: iso,
            valor: r.amount,
            tipo: "CREDIT",
            tipo_lancamento: "credito",
            descricao: r.descricao ?? r.raw_message.slice(0, 120),
            categoria: r.bank_name ?? "SMS",
            raw: r as unknown as Record<string, unknown>,
          });
          if (error) throw error;
        }
        await supabase
          .from("sms_review_queue")
          .update({ status: "approved", target_ref: r.kind })
          .eq("id", r.id);
        ok++;
      } catch (e) {
        fail++;
        console.error("approve sms", e);
      }
    }
    await refresh();
    return { ok, fail };
  }, [user, refresh]);

  return { items, loading, refresh, insertMany, update, reject, approve };
}
