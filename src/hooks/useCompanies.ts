import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { onlyDigits } from "@/lib/cnpj";

export type AccessStatus = "liberado" | "bloqueado" | "pendente";

export const ACCESS_LABEL: Record<AccessStatus, string> = {
  liberado: "Liberado",
  bloqueado: "Bloqueado",
  pendente: "Aguardando análise",
};

export interface Company {
  id: string;
  owner_id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  tipo_instituicao: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  access_status: AccessStatus;
  access_note: string | null;
  access_decided_at: string | null;
  notify_email: string | null;
  created_at: string;
}

export interface CompanyNotification {
  id: string;
  organization_id: string;
  status: string;
  recipient_email: string;
  note: string | null;
  sent_at: string | null;
  send_error: string | null;
  created_at: string;
}

export interface NewCompanyInput {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  tipo_instituicao: string;
  telefone?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  notify_email?: string;
  access_status: AccessStatus;
}

/** Cadastro e liberação/bloqueio de acesso das empresas (somente o dono do aplicativo). */
export function useCompanies(enabled: boolean) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [notifications, setNotifications] = useState<CompanyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCompanies([]);
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [orgs, notifs] = await Promise.all([
      supabase.from("organizations").select("*").order("razao_social"),
      supabase
        .from("org_access_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setError(orgs.error?.message ?? null);
    setCompanies((orgs.data as unknown as Company[]) ?? []);
    setNotifications((notifs.data as unknown as CompanyNotification[]) ?? []);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Registra o aviso e tenta enviar o e-mail; se o envio falhar, o motivo fica salvo. */
  const notify = useCallback(
    async (company: Company, status: AccessStatus, note: string | null) => {
      if (!user) return;
      const recipient = (company.notify_email || company.email || "").trim();
      if (!recipient) return;

      let sendError: string | null = null;
      try {
        const { error: fnError } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: status === "liberado" ? "acesso-liberado" : "acesso-bloqueado",
            recipientEmail: recipient,
            idempotencyKey: `org-access-${company.id}-${status}-${Date.now()}`,
            templateData: {
              empresa: company.nome_fantasia || company.razao_social,
              status,
              observacao: note ?? "",
            },
          },
        });
        if (fnError) sendError = fnError.message;
      } catch (e) {
        sendError = e instanceof Error ? e.message : "Falha ao enviar o e-mail.";
      }

      await supabase.from("org_access_notifications").insert({
        organization_id: company.id,
        status,
        recipient_email: recipient,
        note,
        created_by: user.id,
        sent_at: sendError ? null : new Date().toISOString(),
        send_error: sendError,
      });
    },
    [user],
  );

  const createCompany = useCallback(
    async (input: NewCompanyInput) => {
      if (!user) return { ok: false as const, error: "Não autenticado." };
      const { data, error: insError } = await supabase
        .from("organizations")
        .insert({
          owner_id: user.id,
          cnpj: onlyDigits(input.cnpj),
          razao_social: input.razao_social,
          nome_fantasia: input.nome_fantasia || null,
          tipo_instituicao: input.tipo_instituicao,
          telefone: input.telefone || null,
          email: input.email || null,
          cidade: input.cidade || null,
          uf: input.uf || null,
          notify_email: input.notify_email || input.email || null,
          access_status: input.access_status,
          access_decided_at: new Date().toISOString(),
          access_decided_by: user.id,
        })
        .select("*")
        .single();

      if (insError) {
        const msg = insError.message.includes("organizations_cnpj_key")
          ? "Já existe uma empresa cadastrada com este CNPJ."
          : insError.message;
        return { ok: false as const, error: msg };
      }

      await notify(data as unknown as Company, input.access_status, null);
      await refresh();
      return { ok: true as const };
    },
    [user, notify, refresh],
  );

  const setAccess = useCallback(
    async (company: Company, status: AccessStatus, note: string | null) => {
      if (!user) return { ok: false as const, error: "Não autenticado." };
      const { error: upError } = await supabase
        .from("organizations")
        .update({
          access_status: status,
          access_note: note,
          access_decided_at: new Date().toISOString(),
          access_decided_by: user.id,
        })
        .eq("id", company.id);
      if (upError) return { ok: false as const, error: upError.message };

      await notify(company, status, note);
      await refresh();
      return { ok: true as const };
    },
    [user, notify, refresh],
  );

  const updateNotifyEmail = useCallback(
    async (company: Company, email: string) => {
      const { error: upError } = await supabase
        .from("organizations")
        .update({ notify_email: email.trim() || null })
        .eq("id", company.id);
      if (upError) return { ok: false as const, error: upError.message };
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  return {
    companies,
    notifications,
    loading,
    error,
    refresh,
    createCompany,
    setAccess,
    updateNotifyEmail,
  };
}
