ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS temp_password_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.log_access_denied(_module text, _surface text, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org uuid;
  _email text;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  _org := public.org_owner_of(_uid);
  SELECT display_name INTO _email FROM public.profiles WHERE user_id = _uid;

  IF EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE actor_id = _uid
      AND action = 'access_denied'
      AND details->>'module' = _module
      AND details->>'reason' = _reason
      AND created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_logs (org_owner_id, actor_id, actor_email, action, target_user_id, target_email, details)
  VALUES (_org, _uid, _email, 'access_denied', _uid, _email,
          jsonb_build_object('module', _module, 'surface', _surface, 'reason', _reason));
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_denied(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_access_denied(text, text, text) TO authenticated;