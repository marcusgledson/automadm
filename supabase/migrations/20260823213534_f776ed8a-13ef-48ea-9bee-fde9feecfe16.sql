CREATE TABLE public.upload_scan_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sha256 text NOT NULL,
  file_kind text NOT NULL,
  file_size bigint,
  verdict text NOT NULL,
  reason text,
  engine text,
  threats jsonb NOT NULL DEFAULT '[]'::jsonb,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT upload_scan_cache_key UNIQUE (sha256, file_kind)
);

GRANT ALL ON public.upload_scan_cache TO service_role;

ALTER TABLE public.upload_scan_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to scan cache"
ON public.upload_scan_cache
FOR SELECT
TO authenticated
USING (false);

CREATE INDEX idx_upload_scan_cache_expires ON public.upload_scan_cache (expires_at);

CREATE TRIGGER trg_upload_scan_cache_updated_at
BEFORE UPDATE ON public.upload_scan_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();