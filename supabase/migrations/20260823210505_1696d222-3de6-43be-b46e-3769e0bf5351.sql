-- consumption_bills
DROP POLICY IF EXISTS "Users select own bills" ON public.consumption_bills;
DROP POLICY IF EXISTS "Users insert own bills" ON public.consumption_bills;
DROP POLICY IF EXISTS "Users update own bills" ON public.consumption_bills;
DROP POLICY IF EXISTS "Users delete own bills" ON public.consumption_bills;

CREATE POLICY "Users select own bills" ON public.consumption_bills FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bills" ON public.consumption_bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bills" ON public.consumption_bills FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bills" ON public.consumption_bills FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- bank_statements
DROP POLICY IF EXISTS "Users select own bank_statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users insert own bank_statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users update own bank_statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users delete own bank_statements" ON public.bank_statements;

CREATE POLICY "Users select own bank_statements" ON public.bank_statements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bank_statements" ON public.bank_statements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bank_statements" ON public.bank_statements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bank_statements" ON public.bank_statements FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- expenses
DROP POLICY IF EXISTS "Users select own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users delete own expenses" ON public.expenses;

CREATE POLICY "Users select own expenses" ON public.expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own expenses" ON public.expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own expenses" ON public.expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- remover privilégios anônimos residuais
REVOKE ALL ON public.consumption_bills FROM anon;
REVOKE ALL ON public.bank_statements FROM anon;
REVOKE ALL ON public.expenses FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumption_bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.consumption_bills TO service_role;
GRANT ALL ON public.bank_statements TO service_role;
GRANT ALL ON public.expenses TO service_role;