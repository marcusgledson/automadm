DROP POLICY IF EXISTS "Master updates org roles" ON public.user_roles;

CREATE POLICY "Master updates org roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  org_owner_id = public.org_owner_of(auth.uid())
  AND public.can_manage_user(auth.uid(), user_id)
)
WITH CHECK (
  org_owner_id = public.org_owner_of(auth.uid())
  AND public.can_manage_user(auth.uid(), user_id)
  AND (
    public.org_owner_of(auth.uid()) = auth.uid()
    OR public.role_rank(role) < public.user_rank(auth.uid())
  )
);