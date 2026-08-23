-- 1) Bloqueia auto-escalação de privilégios no próprio perfil
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     OR NEW.org_owner_id IS DISTINCT FROM OLD.org_owner_id
     OR NEW.temp_password_expires_at IS DISTINCT FROM OLD.temp_password_expires_at
     OR NEW.password_email_sent_at IS DISTINCT FROM OLD.password_email_sent_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Alteração não permitida: campos administrativos do perfil.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2) Reduz superfície de funções SECURITY DEFINER expostas na API
REVOKE EXECUTE ON FUNCTION public.log_access_denied(text, text, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, PUBLIC;