-- 1) Audit tables: read-only for authenticated (RLS still scopes rows), writes only via trusted server role
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.upload_audit_logs FROM anon;
REVOKE ALL ON public.role_modules FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.upload_audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.upload_audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT ALL ON public.upload_audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_modules TO authenticated;
GRANT ALL ON public.role_modules TO service_role;

-- 2) SECURITY DEFINER functions: never executable by anonymous / PUBLIC
REVOKE EXECUTE ON FUNCTION public.approve_org_request(uuid, app_role, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_org_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_org_by_cnpj(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_app_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_id_of(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_owner_of(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_rank(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_access_denied(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;

-- 3) Client-callable definer RPC must require an authenticated caller
CREATE OR REPLACE FUNCTION public.find_org_by_cnpj(_cnpj text)
RETURNS TABLE(id uuid, razao_social text, nome_fantasia text, tipo_instituicao text, cidade text, uf text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.razao_social, o.nome_fantasia, o.tipo_instituicao, o.cidade, o.uf
  FROM public.organizations o
  WHERE auth.uid() IS NOT NULL
    AND o.cnpj = regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g')
    AND length(regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g')) = 14
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.find_org_by_cnpj(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_org_by_cnpj(text) TO authenticated, service_role;