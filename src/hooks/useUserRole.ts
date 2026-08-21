import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "master" | "operador" | "colaborador" | "leitor";

export const ROLE_LABEL: Record<AppRole, string> = {
  master: "Máster",
  operador: "Operador",
  colaborador: "Colaborador",
  leitor: "Leitor",
};

export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  master: "Acesso total: gerencia usuários, módulos e todos os dados da organização.",
  operador: "Inclui, edita e analisa dados dos módulos liberados.",
  colaborador: "Trabalha nos módulos liberados e solicita autorização para relatórios.",
  leitor: "Apenas visualiza as informações dos módulos liberados.",
};

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [orgOwnerId, setOrgOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRole(null);
      setOrgOwnerId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("role, org_owner_id")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    setRole((data?.role as AppRole) ?? null);
    setOrgOwnerId((data?.org_owner_id as string) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { role, orgOwnerId, loading, isMaster: role === "master", refresh };
}
