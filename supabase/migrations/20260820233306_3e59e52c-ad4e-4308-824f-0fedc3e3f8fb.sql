-- =========================================================
-- FUNDAÇÃO: modos de uso, perfis, metas, demandas
-- =========================================================

-- 1) ENUMS
CREATE TYPE public.app_usage_mode AS ENUM ('pessoal', 'coparticipativo', 'corporativo');
CREATE TYPE public.app_role AS ENUM ('master', 'operador', 'colaborador', 'leitor');
CREATE TYPE public.user_gender AS ENUM ('masculino', 'feminino', 'nao_informar');
CREATE TYPE public.goal_status AS ENUM ('ativa', 'concluida', 'arquivada');
CREATE TYPE public.request_status AS ENUM ('pendente', 'aprovada', 'recusada');

-- 2) PERFIS DE ACESSO (tabela separada — nunca em profiles)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_owner_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'leitor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_owner_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.org_owner_of(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT org_owner_id FROM public.user_roles WHERE user_id = _user_id ORDER BY created_at LIMIT 1),
    _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master');
$$;

CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Master reads org roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE POLICY "Master manages org roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (
    (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()))
    OR (auth.uid() = user_id AND org_owner_id = auth.uid() AND role = 'master')
  );
CREATE POLICY "Master updates org roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()) AND user_id <> auth.uid())
  WITH CHECK (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE POLICY "Master deletes org roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()) AND user_id <> auth.uid());

-- 3) CONFIGURAÇÕES DO APP / ONBOARDING / TEMA
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_mode public.app_usage_mode NOT NULL DEFAULT 'pessoal',
  onboarding_done boolean NOT NULL DEFAULT false,
  enabled_modules text[] NOT NULL DEFAULT ARRAY['extrato','contas','investimentos']::text[],
  palette text NOT NULL DEFAULT 'oliva',
  theme_style text NOT NULL DEFAULT 'neutro',
  logo_url text,
  org_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages settings" ON public.app_settings
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Members read org settings" ON public.app_settings
  FOR SELECT TO authenticated USING (owner_id = public.org_owner_of(auth.uid()));
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) CADASTRO PESSOAL (complementa profiles)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS gender public.user_gender,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_area_code text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS phone_is_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS org_owner_id uuid,
  ADD COLUMN IF NOT EXISTS allowed_modules text[] NOT NULL DEFAULT '{}'::text[];

CREATE POLICY "Master reads org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE POLICY "Master updates org profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));

-- 5) METAS / ORÇAMENTO
CREATE TABLE public.budget_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  escopo text NOT NULL DEFAULT 'energia',
  referencia text,
  valor_orcado numeric NOT NULL DEFAULT 0,
  meta_economia numeric NOT NULL DEFAULT 0,
  prazo date,
  alerta_percentual numeric NOT NULL DEFAULT 100,
  notificar boolean NOT NULL DEFAULT true,
  status public.goal_status NOT NULL DEFAULT 'ativa',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_goals TO authenticated;
GRANT ALL ON public.budget_goals TO service_role;
ALTER TABLE public.budget_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON public.budget_goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_budget_goals_updated_at BEFORE UPDATE ON public.budget_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) DEMANDAS CORPORATIVAS (caixa do proprietário da aplicação)
CREATE TABLE public.corporate_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_solicitante text NOT NULL,
  email text NOT NULL,
  phone_country_code text,
  phone_area_code text,
  phone_number text,
  phone_is_whatsapp boolean NOT NULL DEFAULT false,
  empresa text,
  demanda text NOT NULL,
  modulos_desejados text[] NOT NULL DEFAULT '{}'::text[],
  status public.request_status NOT NULL DEFAULT 'pendente',
  dev_notificado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_requests TO authenticated;
GRANT ALL ON public.corporate_requests TO service_role;
ALTER TABLE public.corporate_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_app_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id AND lower(u.email) = 'marcusgledson@gmail.com'
  );
$$;

CREATE POLICY "Author reads own request" ON public.corporate_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "App owner reads requests" ON public.corporate_requests
  FOR SELECT TO authenticated USING (public.is_app_owner(auth.uid()));
CREATE POLICY "Author creates request" ON public.corporate_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "App owner updates requests" ON public.corporate_requests
  FOR UPDATE TO authenticated USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));
CREATE POLICY "App owner deletes requests" ON public.corporate_requests
  FOR DELETE TO authenticated USING (public.is_app_owner(auth.uid()));
CREATE TRIGGER trg_corporate_requests_updated_at BEFORE UPDATE ON public.corporate_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) SOLICITAÇÕES DE RELATÓRIO (Colaborador -> Máster)
CREATE TABLE public.report_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_owner_id uuid NOT NULL,
  modulo text NOT NULL,
  formato text NOT NULL DEFAULT 'xlsx',
  justificativa text,
  status public.request_status NOT NULL DEFAULT 'pendente',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_requests TO authenticated;
GRANT ALL ON public.report_requests TO service_role;
ALTER TABLE public.report_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requester reads own report requests" ON public.report_requests
  FOR SELECT TO authenticated USING (auth.uid() = requester_id);
CREATE POLICY "Requester creates report request" ON public.report_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE POLICY "Master reads org report requests" ON public.report_requests
  FOR SELECT TO authenticated USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE POLICY "Master decides report requests" ON public.report_requests
  FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE TRIGGER trg_report_requests_updated_at BEFORE UPDATE ON public.report_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_roles_org ON public.user_roles(org_owner_id);
CREATE INDEX idx_budget_goals_user ON public.budget_goals(user_id, status);
CREATE INDEX idx_report_requests_org ON public.report_requests(org_owner_id, status);