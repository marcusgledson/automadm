CREATE POLICY "Org members read bills" ON public.consumption_bills FOR SELECT TO authenticated USING (public.org_owner_of(user_id) = public.org_owner_of(auth.uid()));
CREATE POLICY "Org members read expenses" ON public.expenses FOR SELECT TO authenticated USING (public.org_owner_of(user_id) = public.org_owner_of(auth.uid()));
CREATE POLICY "Org members read investments" ON public.investments FOR SELECT TO authenticated USING (public.org_owner_of(user_id) = public.org_owner_of(auth.uid()));
CREATE POLICY "Org members read goals" ON public.budget_goals FOR SELECT TO authenticated USING (public.org_owner_of(user_id) = public.org_owner_of(auth.uid()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['consumption_bills','expenses','investments','budget_goals','bank_statements','sms_review_queue'] LOOP
    EXECUTE format('CREATE POLICY "Leitor cannot insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), ''leitor''))', t);
    EXECUTE format('CREATE POLICY "Leitor cannot update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), ''leitor''))', t);
    EXECUTE format('CREATE POLICY "Leitor cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), ''leitor''))', t);
  END LOOP;
END $$;

CREATE POLICY "Leitor cannot request reports" ON public.report_requests AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'leitor'));