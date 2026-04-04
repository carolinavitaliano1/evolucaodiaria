CREATE POLICY "Portal user can upload receipt files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-documents'
  AND EXISTS (
    SELECT 1 FROM patient_portal_accounts ppa
    WHERE ppa.id::text = (storage.foldername(name))[2]
      AND ppa.user_id = auth.uid()
      AND ppa.status = 'active'
  )
);