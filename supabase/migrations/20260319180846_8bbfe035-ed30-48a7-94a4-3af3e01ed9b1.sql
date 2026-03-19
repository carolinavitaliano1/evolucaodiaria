
-- Add attachment support to team_attendance
ALTER TABLE public.team_attendance 
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Create storage bucket for attendance attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-attachments', 'attendance-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: org members can upload/view, owners/admins can delete
CREATE POLICY "Org members can upload attendance attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attendance-attachments');

CREATE POLICY "Org members can view attendance attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attendance-attachments');

CREATE POLICY "Uploader can delete attendance attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attendance-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
