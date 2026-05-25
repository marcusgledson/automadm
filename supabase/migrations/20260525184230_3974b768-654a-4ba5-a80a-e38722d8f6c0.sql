-- Tipos de conta de consumo
CREATE TYPE public.bill_type AS ENUM ('energia', 'internet', 'agua', 'iptu', 'ipva', 'taxa', 'gas', 'telefone', 'outro');
CREATE TYPE public.bill_source AS ENUM ('drive', 'upload', 'manual');

CREATE TABLE public.consumption_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo_conta public.bill_type NOT NULL DEFAULT 'energia',
  fornecedor TEXT,
  codigo_instalacao TEXT NOT NULL,
  titular TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  mes_referencia TEXT,
  data_vencimento DATE NOT NULL,
  valor_total NUMERIC(14,2),
  consumo NUMERIC(14,3),
  unidade_consumo TEXT,
  impostos JSONB DEFAULT '{}'::jsonb,
  itens JSONB DEFAULT '[]'::jsonb,
  historico JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  file_name TEXT,
  source public.bill_source NOT NULL DEFAULT 'upload',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único: instalação + vencimento por usuário (regra anti-duplicidade)
CREATE UNIQUE INDEX consumption_bills_unique_key
  ON public.consumption_bills (user_id, codigo_instalacao, data_vencimento);

CREATE INDEX consumption_bills_user_idx ON public.consumption_bills (user_id);
CREATE INDEX consumption_bills_venc_idx ON public.consumption_bills (data_vencimento);
CREATE INDEX consumption_bills_tipo_idx ON public.consumption_bills (tipo_conta);
CREATE INDEX consumption_bills_ref_idx  ON public.consumption_bills (mes_referencia);

-- RLS
ALTER TABLE public.consumption_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own bills"
  ON public.consumption_bills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bills"
  ON public.consumption_bills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bills"
  ON public.consumption_bills FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own bills"
  ON public.consumption_bills FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER trg_consumption_bills_updated_at
  BEFORE UPDATE ON public.consumption_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();