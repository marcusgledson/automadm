CREATE TABLE public.drive_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_links TO authenticated;
GRANT ALL ON public.drive_links TO service_role;

ALTER TABLE public.drive_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own drive links" ON public.drive_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own drive links" ON public.drive_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own drive links" ON public.drive_links
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own drive links" ON public.drive_links
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_drive_links_updated_at
  BEFORE UPDATE ON public.drive_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();