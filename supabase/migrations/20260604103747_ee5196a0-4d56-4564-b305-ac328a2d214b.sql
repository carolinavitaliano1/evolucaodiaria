DROP POLICY IF EXISTS "Org members can view attendance attachments" ON storage.objects;

CREATE POLICY "Uploader can view attendance attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);