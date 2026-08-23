CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  apelido TEXT NOT NULL,
  banco TEXT,
  banco_codigo TEXT,
  agencia TEXT NOT NULL,
  conta TEXT NOT NULL,
  titular TEXT,
  documento TEXT,
  documento_tipo TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bank_accounts_unique_key ON public.bank_accounts (user_id, agencia, conta);
CREATE INDEX bank_accounts_documento_idx ON public.bank_accounts (user_id, documento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select_own" ON public.bank_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "bank_accounts_insert_own" ON public.bank_accounts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bank_accounts_update_own" ON public.bank_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bank_accounts_delete_own" ON public.bank_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS titular TEXT,
  ADD COLUMN IF NOT EXISTS documento_titular TEXT;