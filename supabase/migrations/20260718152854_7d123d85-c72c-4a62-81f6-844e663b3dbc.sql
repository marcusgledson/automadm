
-- =========================================
-- sms_bank_configs
-- =========================================
CREATE TABLE public.sms_bank_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  senders TEXT[] NOT NULL DEFAULT '{}',
  debit_keywords TEXT[] NOT NULL DEFAULT '{}',
  credit_keywords TEXT[] NOT NULL DEFAULT '{}',
  amount_regex TEXT,
  agencia TEXT,
  conta TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_preset BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, bank_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_bank_configs TO authenticated;
GRANT ALL ON public.sms_bank_configs TO service_role;

ALTER TABLE public.sms_bank_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own sms bank configs"
  ON public.sms_bank_configs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sms_bank_configs_updated_at
  BEFORE UPDATE ON public.sms_bank_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sms_bank_configs_user ON public.sms_bank_configs(user_id);

-- =========================================
-- sms_review_queue
-- =========================================
CREATE TYPE public.sms_review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.sms_txn_kind AS ENUM ('debit', 'credit', 'unknown');

CREATE TABLE public.sms_review_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_config_id UUID REFERENCES public.sms_bank_configs(id) ON DELETE SET NULL,
  bank_name TEXT,
  sender TEXT,
  raw_message TEXT NOT NULL,
  received_at TIMESTAMPTZ,
  kind public.sms_txn_kind NOT NULL DEFAULT 'unknown',
  amount NUMERIC(14,2),
  descricao TEXT,
  agencia TEXT,
  conta TEXT,
  status public.sms_review_status NOT NULL DEFAULT 'pending',
  target_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_review_queue TO authenticated;
GRANT ALL ON public.sms_review_queue TO service_role;

ALTER TABLE public.sms_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own sms review queue"
  ON public.sms_review_queue
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sms_review_queue_updated_at
  BEFORE UPDATE ON public.sms_review_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sms_review_queue_user_status ON public.sms_review_queue(user_id, status);
CREATE INDEX idx_sms_review_queue_received ON public.sms_review_queue(received_at DESC);
