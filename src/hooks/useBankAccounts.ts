import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { KnownAccount } from "@/lib/accountHolder";

export interface BankAccountRow extends KnownAccount {
  user_id: string;
  banco_codigo: string | null;
  documento_tipo: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveAccountInput {
  apelido: string;
  agencia: string;
  conta: string;
  banco?: string | null;
  bancoCodigo?: string | null;
  titular?: string | null;
  documento?: string | null;
  documentoTipo?: string | null;
}

export function useBankAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .order("apelido", { ascending: true });
    if (!error && data) setAccounts(data as unknown as BankAccountRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  /** Cria ou atualiza a conta pela chave (usuário + agência + conta). */
  const saveAccount = useCallback(
    async (input: SaveAccountInput): Promise<{ ok: boolean; id?: string; error?: string }> => {
      if (!user) return { ok: false, error: "Não autenticado" };
      const payload = {
        user_id: user.id,
        apelido: input.apelido,
        agencia: input.agencia,
        conta: input.conta,
        banco: input.banco ?? null,
        banco_codigo: input.bancoCodigo ?? null,
        titular: input.titular ?? null,
        documento: input.documento ?? null,
        documento_tipo: input.documentoTipo ?? null,
      };
      const { data, error } = await supabase
        .from("bank_accounts")
        .upsert(payload as never, { onConflict: "user_id,agencia,conta" })
        .select("id")
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      await fetchAll();
      return { ok: true, id: (data as { id?: string } | null)?.id };
    },
    [user, fetchAll],
  );

  return { accounts, loading, fetchAll, saveAccount };
}
