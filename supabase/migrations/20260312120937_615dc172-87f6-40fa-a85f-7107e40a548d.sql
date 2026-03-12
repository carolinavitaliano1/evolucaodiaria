
-- 1. Add new columns to patient_portal_accounts
ALTER TABLE public.patient_portal_accounts
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'patient',
  ADD COLUMN IF NOT EXISTS access_label text,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{"messages":true,"feedbacks":true,"financial":true,"contract":true,"intake":true,"notices":true,"documents":true}'::jsonb;

-- 2. Remove the unique constraint on patient_id to allow multiple accounts per patient
ALTER TABLE public.patient_portal_accounts
  DROP CONSTRAINT IF EXISTS patient_portal_accounts_patient_id_key;

-- 3. Create portal_documents table
CREATE TABLE IF NOT EXISTS public.portal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  therapist_user_id uuid NOT NULL,
  portal_account_id uuid REFERENCES public.patient_portal_accounts(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size integer,
  description text,
  uploaded_by_type text NOT NULL DEFAULT 'therapist',
  uploaded_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS on portal_documents
ALTER TABLE public.portal_documents ENABLE ROW LEVEL SECURITY;

-- 5. Therapist can manage all portal documents they own
CREATE POLICY "Therapist manages portal documents"
  ON public.portal_documents FOR ALL
  TO authenticated
  USING (therapist_user_id = auth.uid())
  WITH CHECK (therapist_user_id = auth.uid());

-- 6. Portal user can SELECT only documents linked to their specific account
CREATE POLICY "Portal user can view own documents"
  ON public.portal_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_portal_accounts ppa
      WHERE ppa.id = portal_account_id
        AND ppa.user_id = auth.uid()
        AND ppa.status = 'active'
    )
  );

-- 7. Portal user can INSERT documents linked to their own account only
CREATE POLICY "Portal user can upload documents"
  ON public.portal_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by_type = 'portal'
    AND uploaded_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.patient_portal_accounts ppa
      WHERE ppa.id = portal_account_id
        AND ppa.user_id = auth.uid()
        AND ppa.status = 'active'
    )
  );

-- 8. Portal user can delete their own uploads
CREATE POLICY "Portal user can delete own uploads"
  ON public.portal_documents FOR DELETE
  TO authenticated
  USING (
    uploaded_by_type = 'portal'
    AND uploaded_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.patient_portal_accounts ppa
      WHERE ppa.id = portal_account_id
        AND ppa.user_id = auth.uid()
        AND ppa.status = 'active'
    )
  );

-- 9. Storage bucket for portal documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-documents', 'portal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 10. Storage: therapist manages files in their own folder (therapist_user_id/portal_account_id/filename)
CREATE POLICY "Therapist can manage portal document files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'portal-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'portal-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 11. Portal user SELECT: folder[2] = portal_account_id
CREATE POLICY "Portal user can access own document files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'portal-documents'
    AND EXISTS (
      SELECT 1 FROM public.patient_portal_accounts ppa
      WHERE ppa.id::text = (storage.foldername(name))[2]
        AND ppa.user_id = auth.uid()
        AND ppa.status = 'active'
    )
  );

CREATE POLICY "Portal user can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'portal-documents'
    AND EXISTS (
      SELECT 1 FROM public.patient_portal_accounts ppa
      WHERE ppa.id::text = (storage.foldername(name))[2]
        AND ppa.user_id = auth.uid()
        AND ppa.status = 'active'
    )
  );

CREATE POLICY "Portal user can delete own uploaded files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'portal-documents'
    AND EXISTS (
      SELECT 1 FROM public.patient_portal_accounts ppa
      WHERE ppa.id::text = (storage.foldername(name))[2]
        AND ppa.user_id = auth.uid()
        AND ppa.status = 'active'
    )
  );

-- 12. Timestamp trigger for portal_documents
CREATE TRIGGER update_portal_documents_updated_at
  BEFORE UPDATE ON public.portal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
