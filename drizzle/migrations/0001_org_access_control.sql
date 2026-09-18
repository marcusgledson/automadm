-- Controle de liberação/bloqueio de acesso por empresa (administrado pelo dono do aplicativo)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'liberado',
  ADD COLUMN IF NOT EXISTS access_note text,
  ADD COLUMN IF NOT EXISTS access_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_decided_by uuid,
  ADD COLUMN IF NOT EXISTS notify_email text;

CREATE POLICY "Dono do app vê todas as empresas"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_app_owner(auth.uid()));

CREATE POLICY "Dono do app cadastra empresas"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (public.is_app_owner(auth.uid()));

CREATE POLICY "Dono do app altera empresas"
ON public.organizations FOR UPDATE TO authenticated
USING (public.is_app_owner(auth.uid()))
WITH CHECK (public.is_app_owner(auth.uid()));

CREATE TABLE IF NOT EXISTS public.org_access_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL,
  recipient_email text NOT NULL,
  note text,
  created_by uuid NOT NULL,
  sent_at timestamptz,
  send_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.org_access_notifications TO authenticated;
GRANT ALL ON public.org_access_notifications TO service_role;

ALTER TABLE public.org_access_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono do app gerencia notificações de acesso"
ON public.org_access_notifications FOR ALL TO authenticated
USING (public.is_app_owner(auth.uid()))
WITH CHECK (public.is_app_owner(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_org_access_notifications_org
  ON public.org_access_notifications (organization_id, created_at DESC);
