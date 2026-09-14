import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Módulo dono do link (cada tela vê apenas os seus). */
export type DriveModule = "extrato" | "contas" | "investimentos";
/** Tipo de arquivo importado pela tela. */
export type DriveFileKind = "ofx" | "pdf" | "planilha";

export interface DriveLink {
  id: string;
  url: string;
  label: string | null;
  module: string;
  file_kind: string;
  created_at: string;
}

export function useDriveLinks(scope: { module: DriveModule; fileKind: DriveFileKind }) {
  const { module, fileKind } = scope;
  const { user } = useAuth();
  const [links, setLinks] = useState<DriveLink[]>([]);
  const [otherLinks, setOtherLinks] = useState<DriveLink[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("drive_links")
      .select("id,url,label,module,file_kind,created_at")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const all = data as unknown as DriveLink[];
      setLinks(all.filter((l) => l.module === module && l.file_kind === fileKind));
      setOtherLinks(all.filter((l) => l.module !== module || l.file_kind !== fileKind));
    }
    setLoading(false);
  }, [user, module, fileKind]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addLink = useCallback(async (url: string, label?: string) => {
    if (!user) return { ok: false, error: "Não autenticado" };
    const clean = url.trim();
    if (!clean) return { ok: false, error: "Link vazio" };
    const { error } = await supabase
      .from("drive_links")
      .upsert(
        { user_id: user.id, url: clean, label: label?.trim() || null, module, file_kind: fileKind } as never,
        { onConflict: "user_id,module,file_kind,url" },
      );
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }, [user, refresh, module, fileKind]);

  /** Traz um link salvo em outra tela para a tela atual. */
  const moveLink = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("drive_links")
      .update({ module, file_kind: fileKind } as never)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }, [refresh, module, fileKind]);

  const removeLink = useCallback(async (id: string) => {
    const { error } = await supabase.from("drive_links").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }, [refresh]);

  return { links, otherLinks, loading, addLink, moveLink, removeLink, refresh };
}

