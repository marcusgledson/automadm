
CREATE OR REPLACE FUNCTION public.role_rank(_role app_role)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role WHEN 'master' THEN 4 WHEN 'operador' THEN 3 WHEN 'colaborador' THEN 2 ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.user_rank(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(public.role_rank(role)), 0) FROM public.user_roles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(_actor uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _actor IS NOT NULL
     AND _target IS NOT NULL
     AND _actor <> _target
     AND public.is_master(_actor)
     AND public.org_owner_of(_actor) = public.org_owner_of(_target)
     AND (public.org_owner_of(_actor) = _actor OR public.user_rank(_actor) > public.user_rank(_target));
$$;

-- Perfis: Máster só enxerga/edita quem está abaixo do seu nível
DROP POLICY IF EXISTS "Master reads org profiles" ON public.profiles;
CREATE POLICY "Master reads org profiles" ON public.profiles FOR SELECT TO authenticated
USING (org_owner_id = public.org_owner_of(auth.uid()) AND public.can_manage_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "Master updates org profiles" ON public.profiles;
CREATE POLICY "Master updates org profiles" ON public.profiles FOR UPDATE TO authenticated
USING (org_owner_id = public.org_owner_of(auth.uid()) AND public.can_manage_user(auth.uid(), user_id))
WITH CHECK (org_owner_id = public.org_owner_of(auth.uid()) AND public.can_manage_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Papéis: mesma hierarquia
DROP POLICY IF EXISTS "Master reads org roles" ON public.user_roles;
CREATE POLICY "Master reads org roles" ON public.user_roles FOR SELECT TO authenticated
USING (org_owner_id = public.org_owner_of(auth.uid()) AND public.can_manage_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "Master updates org roles" ON public.user_roles;
CREATE POLICY "Master updates org roles" ON public.user_roles FOR UPDATE TO authenticated
USING (org_owner_id = public.org_owner_of(auth.uid()) AND public.can_manage_user(auth.uid(), user_id))
WITH CHECK (org_owner_id = public.org_owner_of(auth.uid()) AND public.can_manage_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "Master deletes org roles" ON public.user_roles;
CREATE POLICY "Master deletes org roles" ON public.user_roles FOR DELETE TO authenticated
USING (org_owner_id = public.org_owner_of(auth.uid()) AND public.can_manage_user(auth.uid(), user_id));

-- Auditoria
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_owner_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master reads org audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE INDEX idx_audit_logs_org_created ON public.audit_logs (org_owner_id, created_at DESC);

-- Módulos por perfil
CREATE TABLE public.role_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_owner_id uuid NOT NULL,
  role app_role NOT NULL,
  allowed_modules text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_owner_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_modules TO authenticated;
GRANT ALL ON public.role_modules TO service_role;
ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read org role modules" ON public.role_modules FOR SELECT TO authenticated
USING (org_owner_id = public.org_owner_of(auth.uid()));
CREATE POLICY "Master manages role modules" ON public.role_modules FOR ALL TO authenticated
USING (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()))
WITH CHECK (public.is_master(auth.uid()) AND org_owner_id = public.org_owner_of(auth.uid()));
CREATE TRIGGER trg_role_modules_updated_at BEFORE UPDATE ON public.role_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
