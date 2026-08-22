DROP POLICY IF EXISTS "Master manages org roles" ON public.user_roles;

CREATE POLICY "Master manages org roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Bootstrap: usuário cria a própria organização como Máster.
  (auth.uid() = user_id AND org_owner_id = auth.uid() AND role = 'master')
  OR (
    public.is_master(auth.uid())
    AND org_owner_id = public.org_owner_of(auth.uid())
    AND user_id <> auth.uid()
    -- Alvo precisa já pertencer à mesma organização.
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id AND p.org_owner_id = user_roles.org_owner_id
    )
    -- Dono da organização concede qualquer perfil; demais Másters só abaixo do próprio nível.
    AND (
      public.org_owner_of(auth.uid()) = auth.uid()
      OR public.role_rank(role) < public.user_rank(auth.uid())
    )
  )
);

-- Funções internas não devem ser chamáveis via API por qualquer papel.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_rank(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.role_rank(public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_master(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_owner_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_app_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_access_denied(text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_owner_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_access_denied(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_rank(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.role_rank(public.app_role) TO service_role;