import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { onlyDigits } from "@/lib/cnpj";

export interface Organization {
  id: string;
  owner_id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  tipo_instituicao: string;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export type OrganizationInput = Omit<Organization, "id" | "owner_id">;

/** Dados mínimos devolvidos na consulta pública por CNPJ. */
export interface OrgSummary {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  tipo_instituicao: string;
  cidade: string | null;
  uf: string | null;
}

export function useOrganization() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string>("aprovado");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrganization(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("organization_id, approval_status")
      .eq("user_id", user.id)
      .maybeSingle();

    setApprovalStatus((prof?.approval_status as string) ?? "aprovado");

    if (!prof?.organization_id) {
      // Pode ser o dono que ainda não vinculou o perfil.
      const { data: own } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      setOrganization((own as Organization) ?? null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", prof.organization_id)
      .maybeSingle();
    setOrganization((data as Organization) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Consulta se já existe empresa com o CNPJ informado (retorna apenas dados públicos). */
  const findByCnpj = useCallback(async (cnpj: string): Promise<OrgSummary | null> => {
    const { data, error } = await supabase.rpc("find_org_by_cnpj", { _cnpj: onlyDigits(cnpj) });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as OrgSummary) ?? null;
  }, []);

  /** Cria a empresa e vincula o usuário atual como Máster/dono. */
  const createOrganization = useCallback(
    async (input: OrganizationInput) => {
      if (!user) return { ok: false as const, error: "Não autenticado." };
      const cnpj = onlyDigits(input.cnpj);

      const { data, error } = await supabase
        .from("organizations")
        .insert({ ...input, cnpj, owner_id: user.id })
        .select("*")
        .single();

      if (error) {
        const msg = error.message.includes("organizations_cnpj_key")
          ? "Já existe uma empresa cadastrada com este CNPJ."
          : error.message;
        return { ok: false as const, error: msg };
      }

      const org = data as Organization;
      await supabase
        .from("profiles")
        .update({ organization_id: org.id, org_owner_id: user.id, approval_status: "aprovado" })
        .eq("user_id", user.id);
      await supabase
        .from("user_roles")
        .upsert(
          { user_id: user.id, org_owner_id: user.id, organization_id: org.id, role: "master" as const },
          { onConflict: "user_id,org_owner_id,role" },
        );

      await refresh();
      return { ok: true as const, organization: org };
    },
    [user, refresh],
  );

  const updateOrganization = useCallback(
    async (patch: Partial<OrganizationInput>) => {
      if (!organization) return { ok: false as const, error: "Empresa não encontrada." };
      const { error } = await supabase
        .from("organizations")
        .update({ ...patch, ...(patch.cnpj ? { cnpj: onlyDigits(patch.cnpj) } : {}) })
        .eq("id", organization.id);
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [organization, refresh],
  );

  /** Solicita acesso a uma empresa existente; o usuário fica pendente de aprovação. */
  const requestAccess = useCallback(
    async (organizationId: string, name?: string | null) => {
      if (!user) return { ok: false as const, error: "Não autenticado." };
      const { error } = await supabase.from("org_access_requests").insert({
        organization_id: organizationId,
        requester_id: user.id,
        requester_email: user.email ?? null,
        requester_name: name ?? null,
        requested_role: "leitor" as const,
        status: "pendente" as const,
      });
      if (error) return { ok: false as const, error: error.message };

      await supabase
        .from("profiles")
        .update({ organization_id: organizationId, approval_status: "pendente" })
        .eq("user_id", user.id);

      await refresh();
      return { ok: true as const };
    },
    [user, refresh],
  );

  return {
    organization,
    approvalStatus,
    isPending: approvalStatus === "pendente",
    loading,
    refresh,
    findByCnpj,
    createOrganization,
    updateOrganization,
    requestAccess,
  };
}
