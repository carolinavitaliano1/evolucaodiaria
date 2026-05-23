-- Remove anonymous read access on patient_documents
DROP POLICY IF EXISTS "Public read patient_documents" ON storage.objects;

-- Make bucket non-public so getPublicUrl direct access stops working without auth
UPDATE storage.buckets SET public = false WHERE id = 'patient_documents';