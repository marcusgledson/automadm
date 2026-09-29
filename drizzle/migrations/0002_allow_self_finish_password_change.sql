CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _self_finish boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() <> NEW.user_id AND public.can_manage_user(auth.uid(), NEW.user_id) THEN RETURN NEW; END IF;

  -- O próprio usuário pode concluir a troca obrigatória (desligar a obrigação e limpar o prazo), nunca ligá-la.
  _self_finish := auth.uid() = NEW.user_id
    AND OLD.must_change_password = true AND NEW.must_change_password = false;
  IF _self_finish THEN
    NEW.temp_password_expires_at := NULL;
  END IF;

  IF NEW.allowed_modules IS DISTINCT FROM OLD.allowed_modules
     OR (NEW.must_change_password IS DISTINCT FROM OLD.must_change_password AND NOT _self_finish)
     OR (NEW.temp_password_expires_at IS DISTINCT FROM OLD.temp_password_expires_at AND NOT _self_finish)
     OR NEW.password_email_sent_at IS DISTINCT FROM OLD.password_email_sent_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Alteração não permitida: campos administrativos do perfil.';
  END IF;

  IF NEW.org_owner_id IS DISTINCT FROM OLD.org_owner_id THEN
    IF NOT (NEW.org_owner_id = auth.uid() AND NEW.organization_id IS NOT NULL
            AND public.is_org_owner(auth.uid(), NEW.organization_id)) THEN
      RAISE EXCEPTION 'Alteração não permitida: vínculo administrativo do perfil.';
    END IF;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NOT (NEW.approval_status = 'pendente'
            OR (NEW.organization_id IS NOT NULL AND public.is_org_owner(auth.uid(), NEW.organization_id))) THEN
      RAISE EXCEPTION 'Alteração não permitida: situação de aprovação do perfil.';
    END IF;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND NEW.organization_id IS NOT NULL
     AND NOT public.is_org_owner(auth.uid(), NEW.organization_id)
     AND NEW.approval_status <> 'pendente' THEN
    RAISE EXCEPTION 'Alteração não permitida: aguarde a aprovação do Máster da empresa.';
  END IF;

  RETURN NEW;
END;
$function$;