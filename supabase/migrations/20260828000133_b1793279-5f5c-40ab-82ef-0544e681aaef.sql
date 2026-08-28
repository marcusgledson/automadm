-- Allow authors/requesters to delete only their own still-pending requests
DROP POLICY IF EXISTS "Authors can delete own pending corporate requests" ON public.corporate_requests;
CREATE POLICY "Authors can delete own pending corporate requests"
ON public.corporate_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status = 'pendente');

DROP POLICY IF EXISTS "Requesters can delete own pending access requests" ON public.org_access_requests;
CREATE POLICY "Requesters can delete own pending access requests"
ON public.org_access_requests
FOR DELETE
TO authenticated
USING (auth.uid() = requester_id AND status = 'pendente');