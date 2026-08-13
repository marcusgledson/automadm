CREATE TYPE public.investment_source AS ENUM ('upload','manual','drive');

CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instituicao text NOT NULL DEFAULT '',
  tipo_investimento text NOT NULL DEFAULT '',
  ativo text NOT NULL,
  valor_aplicado numeric,
  valor_bruto numeric,
  valor_liquido numeric,
  rendimento numeric,
  data_aplicacao date NOT NULL,
  data_vencimento date,
  data_carencia date,
  liquidez text,
  indexador text,
  percentual_indexador numeric,
  taxa_contratada text,
  rentabilidade_periodo numeric,
  ir numeric,
  iof numeric,
  quantidade numeric,
  preco_unitario numeric,
  observacoes text,
  explicacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_name text,
  source public.investment_source NOT NULL DEFAULT 'upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investments_unique_key UNIQUE (user_id, instituicao, ativo, data_aplicacao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own investments" ON public.investments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own investments" ON public.investments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own investments" ON public.investments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own investments" ON public.investments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_investments_updated_at BEFORE UPDATE ON public.investments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();