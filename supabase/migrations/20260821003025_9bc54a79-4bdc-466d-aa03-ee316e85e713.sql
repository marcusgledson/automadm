
REVOKE EXECUTE ON FUNCTION public.user_rank(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.role_rank(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_rank(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.role_rank(app_role) TO authenticated, service_role;
