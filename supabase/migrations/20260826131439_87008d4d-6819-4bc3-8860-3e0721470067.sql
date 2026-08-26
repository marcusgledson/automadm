-- ============ ORGANIZAÇÕES ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  tipo_instituicao text NOT NULL DEFAULT 'outro',
  telefone text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organizations_cnpj_key ON public.organizations (cnpj);

GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============ PERFIS: vínculo com a organização ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'aprovado';

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Helper: organização do usuário (evita recursão nas policies)
CREATE OR REPLACE FUNCTION public.org_id_of(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.org_id_of(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.org_id_of(uuid) TO authenticated, service_role;

CREATE POLICY "Membros veem a própria empresa"
ON public.organizations FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR id = public.org_id_of(auth.uid()));

CREATE POLICY "Usuário cria a própria empresa"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Somente o dono altera a empresa"
ON public.organizations FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PEDIDOS DE ACESSO ============
CREATE TABLE public.org_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  requester_email text,
  requester_name text,
  requested_role app_role NOT NULL DEFAULT 'leitor',
  status request_status NOT NULL DEFAULT 'pendente',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_access_requests_org_idx ON public.org_access_requests (organization_id, status);

GRANT SELECT, INSERT, UPDATE ON public.org_access_requests TO authenticated;
GRANT ALL ON public.org_access_requests TO service_role;

ALTER TABLE public.org_access_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Solicitante vê o próprio pedido"
ON public.org_access_requests FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR public.is_org_owner(auth.uid(), organization_id));

CREATE POLICY "Solicitante cria o próprio pedido"
ON public.org_access_requests FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid() AND status = 'pendente');

CREATE POLICY "Máster da empresa decide o pedido"
ON public.org_access_requests FOR UPDATE TO authenticated
USING (public.is_org_owner(auth.uid(), organization_id))
WITH CHECK (public.is_org_owner(auth.uid(), organization_id));

CREATE TRIGGER trg_org_access_requests_updated_at
BEFORE UPDATE ON public.org_access_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CONSULTA DE CNPJ (dados mínimos) ============
CREATE OR REPLACE FUNCTION public.find_org_by_cnpj(_cnpj text)
RETURNS TABLE (id uuid, razao_social text, nome_fantasia text, tipo_instituicao text, cidade text, uf text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.razao_social, o.nome_fantasia, o.tipo_instituicao, o.cidade, o.uf
  FROM public.organizations o
  WHERE o.cnpj = regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g')
    AND length(regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g')) = 14
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.find_org_by_cnpj(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_org_by_cnpj(text) TO authenticated, service_role;

-- ============ APROVAÇÃO DE PEDIDO (transacional) ============
CREATE OR REPLACE FUNCTION public.approve_org_request(_request_id uuid, _role app_role, _modules text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.org_access_requests%ROWTYPE;
  _owner uuid;
BEGIN
  SELECT * INTO _req FROM public.org_access_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT owner_id INTO _owner FROM public.organizations WHERE id = _req.organization_id;
  IF _owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Apenas o Máster da empresa pode aprovar este pedido.';
  END IF;

  UPDATE public.org_access_requests
     SET status = 'aprovada', decided_by = auth.uid(), decided_at = now()
   WHERE id = _request_id;

  UPDATE public.profiles
     SET organization_id = _req.organization_id,
         org_owner_id = _owner,
         approval_status = 'aprovado',
         allowed_modules = COALESCE(_modules, allowed_modules)
   WHERE user_id = _req.requester_id;

  DELETE FROM public.user_roles WHERE user_id = _req.requester_id;
  INSERT INTO public.user_roles (user_id, org_owner_id, organization_id, role)
  VALUES (_req.requester_id, _owner, _req.organization_id, _role);

  INSERT INTO public.audit_logs (org_owner_id, actor_id, actor_email, action, target_user_id, target_email, details)
  VALUES (_owner, auth.uid(), NULL, 'approve_org_request', _req.requester_id, _req.requester_email,
          jsonb_build_object('role', _role, 'organization_id', _req.organization_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_org_request(uuid, app_role, text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_org_request(uuid, app_role, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_org_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.org_access_requests%ROWTYPE;
  _owner uuid;
BEGIN
  SELECT * INTO _req FROM public.org_access_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
  SELECT owner_id INTO _owner FROM public.organizations WHERE id = _req.organization_id;
  IF _owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Apenas o Máster da empresa pode recusar este pedido.';
  END IF;

  UPDATE public.org_access_requests
     SET status = 'recusada', decided_by = auth.uid(), decided_at = now()
   WHERE id = _request_id;

  INSERT INTO public.audit_logs (org_owner_id, actor_id, actor_email, action, target_user_id, target_email, details)
  VALUES (_owner, auth.uid(), NULL, 'reject_org_request', _req.requester_id, _req.requester_email,
          jsonb_build_object('organization_id', _req.organization_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_org_request(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reject_org_request(uuid) TO authenticated;