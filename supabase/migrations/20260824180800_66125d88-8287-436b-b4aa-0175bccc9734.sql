CREATE TABLE public.pdf_column_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_code text,
  bank_name text,
  header_signature text NOT NULL,
  strategy text NOT NULL DEFAULT 'colunas',
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  uses integer NOT NULL DEFAULT 1,
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, header_signature)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_column_profiles TO authenticated;
GRANT ALL ON public.pdf_column_profiles TO service_role;

ALTER TABLE public.pdf_column_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own pdf profiles" ON public.pdf_column_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pdf profiles" ON public.pdf_column_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pdf profiles" ON public.pdf_column_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own pdf profiles" ON public.pdf_column_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_pdf_column_profiles_user_bank ON public.pdf_column_profiles (user_id, bank_code);

CREATE TRIGGER trg_pdf_column_profiles_updated_at
  BEFORE UPDATE ON public.pdf_column_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();