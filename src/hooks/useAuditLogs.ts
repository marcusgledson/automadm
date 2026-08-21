import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  action: string;
  actor_id: string;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create_user: "Criou usuário",
  reset_password: "Redefiniu senha",
  change_password: "Trocou a própria senha",
  delete_user: "Excluiu usuário",
  update_role: "Alterou perfil de acesso",
  update_modules: "Alterou módulos liberados",
  update_profile: "Atualizou informações cadastrais",
};

export function useAuditLogs(enabled: boolean) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as unknown as AuditLog[]) ?? []);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { logs, loading, refresh };
}
