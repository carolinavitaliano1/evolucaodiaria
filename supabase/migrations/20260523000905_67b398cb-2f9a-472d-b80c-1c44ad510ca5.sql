
-- Storage bucket for in-person session recordings (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-recordings', 'session-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Table for in-person session recordings + transcriptions
CREATE TABLE IF NOT EXISTS public.in_person_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_user_id uuid NOT NULL,
  clinic_id uuid,
  title text,
  storage_path text NOT NULL,
  duration_seconds integer,
  file_size_bytes bigint,
  mime_type text,
  source text NOT NULL DEFAULT 'browser', -- 'browser' | 'upload'
  transcription_status text NOT NULL DEFAULT 'idle', -- idle|processing|ready|error
  transcription_text text,
  transcription_speakers jsonb,
  transcription_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_person_recordings_patient ON public.in_person_recordings(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_person_recordings_therapist ON public.in_person_recordings(therapist_user_id);

ALTER TABLE public.in_person_recordings ENABLE ROW LEVEL SECURITY;

-- Therapist owner OR clinic org owner can manage
CREATE POLICY "Owner therapist or org owner can select recordings"
ON public.in_person_recordings FOR SELECT
USING (
  therapist_user_id = auth.uid()
  OR (clinic_id IS NOT NULL AND public.is_clinic_org_owner(clinic_id, auth.uid()))
);

CREATE POLICY "Owner therapist can insert recordings"
ON public.in_person_recordings FOR INSERT
WITH CHECK (therapist_user_id = auth.uid());

CREATE POLICY "Owner therapist or org owner can update recordings"
ON public.in_person_recordings FOR UPDATE
USING (
  therapist_user_id = auth.uid()
  OR (clinic_id IS NOT NULL AND public.is_clinic_org_owner(clinic_id, auth.uid()))
);

CREATE POLICY "Owner therapist or org owner can delete recordings"
ON public.in_person_recordings FOR DELETE
USING (
  therapist_user_id = auth.uid()
  OR (clinic_id IS NOT NULL AND public.is_clinic_org_owner(clinic_id, auth.uid()))
);

CREATE TRIGGER update_in_person_recordings_updated_at
BEFORE UPDATE ON public.in_person_recordings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage RLS for session-recordings bucket: user folder layout = {uid}/{recording_id}.webm
CREATE POLICY "Users can upload own session recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'session-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own session recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'session-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own session recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'session-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
