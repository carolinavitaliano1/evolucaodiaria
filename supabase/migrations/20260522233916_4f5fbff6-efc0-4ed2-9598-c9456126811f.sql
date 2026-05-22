
ALTER TABLE public.video_sessions
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_sent_channel text;

CREATE INDEX IF NOT EXISTS idx_video_sessions_scheduled_for
  ON public.video_sessions(scheduled_for)
  WHERE link_sent_at IS NULL AND status = 'scheduled';

DROP POLICY IF EXISTS "Portal patient can view own video sessions" ON public.video_sessions;
CREATE POLICY "Portal patient can view own video sessions"
ON public.video_sessions
FOR SELECT
TO authenticated
USING (public.is_portal_patient(patient_id, auth.uid()));
