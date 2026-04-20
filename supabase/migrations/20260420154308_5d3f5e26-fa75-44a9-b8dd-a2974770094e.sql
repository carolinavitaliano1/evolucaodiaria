-- 1. Adicionar colunas de timbrado em clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS document_logo_url text,
  ADD COLUMN IF NOT EXISTS document_header_text text,
  ADD COLUMN IF NOT EXISTS document_footer_text text;

-- 2. Tabela patient_documents
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Documento',
  doc_type text NOT NULL DEFAULT 'livre',
  content text NOT NULL DEFAULT '',
  file_url text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own AI documents"
  ON public.patient_documents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org members view shared AI documents"
  ON public.patient_documents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_clinic_org_member(clinic_id, auth.uid())
    OR public.is_clinic_org_owner(clinic_id, auth.uid())
  );

CREATE TRIGGER trg_patient_documents_updated_at
  BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_patient_documents_user ON public.patient_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_clinic ON public.patient_documents(clinic_id);

-- 3. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient_documents', 'patient_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated read patient_documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'patient_documents');

CREATE POLICY "Public read patient_documents"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'patient_documents');

CREATE POLICY "Users upload own patient_documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'patient_documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own patient_documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'patient_documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own patient_documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'patient_documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Bucket para logos do documento (timbrado) — reutiliza attachments existente
-- Nada a fazer: usaremos o bucket 'attachments' já existente para a logo do timbrado.