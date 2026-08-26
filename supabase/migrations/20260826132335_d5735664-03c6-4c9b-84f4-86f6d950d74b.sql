CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- service_role / operações internas (sem JWT) passam direto
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Máster da mesma organização pode gerenciar campos privilegiados de outros
  IF auth.uid() <> NEW.user_id AND public.can_manage_user(auth.uid(), NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.allowed_modules IS DISTINCT FROM OLD.allowed_modules
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     OR NEW.temp_password_expires_at IS DISTINCT FROM OLD.temp_password_expires_at
     OR NEW.password_email_sent_at IS DISTINCT FROM OLD.password_email_sent_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Alteração não permitida: campos administrativos do perfil.';
  END IF;

  -- org_owner_id: só pode assumir a si mesmo como dono de uma empresa que ele criou
  IF NEW.org_owner_id IS DISTINCT FROM OLD.org_owner_id THEN
    IF NOT (NEW.org_owner_id = auth.uid()
            AND NEW.organization_id IS NOT NULL
            AND public.is_org_owner(auth.uid(), NEW.organization_id))
    THEN
      RAISE EXCEPTION 'Alteração não permitida: vínculo administrativo do perfil.';
    END IF;
  END IF;

  -- approval_status: o próprio usuário só pode marcar-se como pendente,
  -- exceto quando é o dono da organização informada.
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NOT (NEW.approval_status = 'pendente'
            OR (NEW.organization_id IS NOT NULL AND public.is_org_owner(auth.uid(), NEW.organization_id)))
    THEN
      RAISE EXCEPTION 'Alteração não permitida: situação de aprovação do perfil.';
    END IF;
  END IF;

  -- Vincular-se a uma empresa de terceiros exige ficar pendente de aprovação
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND NEW.organization_id IS NOT NULL
     AND NOT public.is_org_owner(auth.uid(), NEW.organization_id)
     AND NEW.approval_status <> 'pendente'
  THEN
    RAISE EXCEPTION 'Alteração não permitida: aguarde a aprovação do Máster da empresa.';
  END IF;

  RETURN NEW;
END;
$function$;