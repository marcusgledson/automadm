import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { DetectedColumn } from "@/lib/pdfStatementParser";

export interface PdfColumnProfile {
  id: string;
  bank_code: string | null;
  bank_name: string | null;
  header_signature: string;
  strategy: string;
  columns: DetectedColumn[];
  uses: number;
  last_used_at: string;
}

interface SaveInput {
  signature: string;
  bankCode?: string;
  bankName?: string;
  strategy: string;
  columns: DetectedColumn[];
}

/** Perfis de mapeamento de colunas de PDF salvos por banco/layout. */
export function usePdfColumnProfiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<PdfColumnProfile[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user) { setProfiles([]); return; }
    const { data, error } = await supabase
      .from("pdf_column_profiles")
      .select("*")
      .order("last_used_at", { ascending: false });
    if (!error && data) setProfiles(data as unknown as PdfColumnProfile[]);
  }, [user]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const findBySignature = useCallback(
    (signature: string) => profiles.find((p) => p.header_signature === signature),
    [profiles],
  );

  const saveProfile = useCallback(
    async (input: SaveInput): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: "Não autenticado" };
      const existing = profiles.find((p) => p.header_signature === input.signature);
      const { error } = await supabase.from("pdf_column_profiles").upsert(
        {
          id: existing?.id,
          user_id: user.id,
          bank_code: input.bankCode ?? null,
          bank_name: input.bankName ?? null,
          header_signature: input.signature,
          strategy: input.strategy,
          columns: input.columns as never,
          uses: (existing?.uses ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,header_signature" },
      );
      if (error) return { ok: false, error: error.message };
      await fetchAll();
      return { ok: true };
    },
    [user, profiles, fetchAll],
  );

  const removeProfile = useCallback(
    async (signature: string) => {
      if (!user) return;
      await supabase.from("pdf_column_profiles").delete().eq("header_signature", signature);
      await fetchAll();
    },
    [user, fetchAll],
  );

  return { profiles, fetchAll, findBySignature, saveProfile, removeProfile };
}
