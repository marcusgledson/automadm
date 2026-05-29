
-- ============================================================
-- bank_statements
-- ============================================================
CREATE TABLE public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agencia TEXT NOT NULL DEFAULT '',
  conta TEXT NOT NULL DEFAULT '',
  banco TEXT,
  fitid TEXT NOT NULL,
  data DATE,
  data_raw TEXT,
  lancamento TEXT,
  descricao TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  tipo TEXT,
  tipo_lancamento TEXT,
  categoria TEXT,
  documento TEXT,
  codigo_operacao TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bank_statements_unique_tx
  ON public.bank_statements (user_id, agencia, conta, fitid);

CREATE INDEX bank_statements_user_data_idx
  ON public.bank_statements (user_id, data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statements TO authenticated;
GRANT ALL ON public.bank_statements TO service_role;

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own bank_statements"
  ON public.bank_statements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bank_statements"
  ON public.bank_statements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bank_statements"
  ON public.bank_statements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own bank_statements"
  ON public.bank_statements FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_bank_statements_updated_at
  BEFORE UPDATE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- expenses
-- ============================================================
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_lancamento TEXT NOT NULL DEFAULT 'Débito',
  categoria TEXT,
  numero_documento TEXT,
  detalhes TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  origem TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX expenses_unique_ofx_ref
  ON public.expenses (user_id, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX expenses_user_venc_idx
  ON public.expenses (user_id, data_vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
