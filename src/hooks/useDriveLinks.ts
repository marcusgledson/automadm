import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DriveLink {
  id: string;
  url: string;
  label: string | null;
  created_at: string;
}

export function useDriveLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<DriveLink[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("drive_links")
      .select("id,url,label,created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setLinks(data as DriveLink[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addLink = useCallback(async (url: string, label?: string) => {
    if (!user) return { ok: false, error: "Não autenticado" };
    const clean = url.trim();
    if (!clean) return { ok: false, error: "Link vazio" };
    const { error } = await supabase
      .from("drive_links")
      .upsert(
        { user_id: user.id, url: clean, label: label?.trim() || null },
        { onConflict: "user_id,url" },
      );
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }, [user, refresh]);

  const removeLink = useCallback(async (id: string) => {
    const { error } = await supabase.from("drive_links").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }, [refresh]);

  return { links, loading, addLink, removeLink, refresh };
}
