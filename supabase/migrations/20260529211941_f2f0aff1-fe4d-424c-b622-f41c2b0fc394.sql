-- Fix #1: Restrict patient_documents bucket SELECT to folder owner only
DROP POLICY IF EXISTS "Authenticated read patient_documents" ON storage.objects;

CREATE POLICY "Users read own patient_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient_documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Fix #2: Allow portal patients to read their own orientações when audience targets patient
CREATE POLICY "Portal patient reads own orientacoes"
ON public.module_orientacoes
FOR SELECT
TO authenticated
USING (
  public.is_portal_patient(patient_id, auth.uid())
  AND audience IN ('patient', 'paciente', 'both', 'ambos', 'all')
);