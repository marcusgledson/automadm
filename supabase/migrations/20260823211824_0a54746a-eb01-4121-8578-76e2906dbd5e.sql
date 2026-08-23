CREATE TABLE public.upload_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_owner_id UUID,
  file_name TEXT,
  file_kind TEXT,
  declared_mime TEXT,
  file_size BIGINT,
  source TEXT NOT NULL DEFAULT 'upload',
  status TEXT NOT NULL,
  reject_reason TEXT,
  scan_result TEXT,
  scan_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_upload_audit_logs_user ON public.upload_audit_logs (user_id, created_at DESC);
CREATE INDEX idx_upload_audit_logs_status ON public.upload_audit_logs (status, created_at DESC);

GRANT SELECT ON public.upload_audit_logs TO authenticated;
GRANT ALL ON public.upload_audit_logs TO service_role;

ALTER TABLE public.upload_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_audit_select_own"
ON public.upload_audit_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.can_manage_user(auth.uid(), user_id));