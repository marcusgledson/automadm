CREATE OR REPLACE FUNCTION public.current_user_is_leitor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leitor');
$$;
REVOKE ALL ON FUNCTION public.current_user_is_leitor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_leitor() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['consumption_bills','expenses','investments','budget_goals','bank_statements','sms_review_queue'] LOOP
    EXECUTE format('ALTER POLICY "Leitor cannot insert" ON public.%I WITH CHECK (NOT public.current_user_is_leitor())', t);
    EXECUTE format('ALTER POLICY "Leitor cannot update" ON public.%I USING (NOT public.current_user_is_leitor())', t);
    EXECUTE format('ALTER POLICY "Leitor cannot delete" ON public.%I USING (NOT public.current_user_is_leitor())', t);
  END LOOP;
END $$;
ALTER POLICY "Leitor cannot request reports" ON public.report_requests WITH CHECK (NOT public.current_user_is_leitor());