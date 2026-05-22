-- Telehealth: video sessions, recordings, and transcriptions

CREATE TABLE public.video_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_user_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  daily_room_name text NOT NULL UNIQUE,
  daily_room_url text NOT NULL,
  patient_access_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'scheduled',
  recording_enabled boolean NOT NULL DEFAULT false,
  patient_consented_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  room_expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_sessions_patient ON public.video_sessions(patient_id);
CREATE INDEX idx_video_sessions_therapist ON public.video_sessions(therapist_user_id);
CREATE INDEX idx_video_sessions_appointment ON public.video_sessions(appointment_id);
CREATE INDEX idx_video_sessions_clinic ON public.video_sessions(clinic_id);

ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist owns own video sessions"
ON public.video_sessions FOR ALL TO authenticated
USING (therapist_user_id = auth.uid())
WITH CHECK (therapist_user_id = auth.uid());

CREATE POLICY "Clinic org members can view video sessions"
ON public.video_sessions FOR SELECT TO authenticated
USING (
  clinic_id IS NOT NULL
  AND (
    public.is_clinic_org_owner(clinic_id, auth.uid())
    OR public.is_clinic_org_member(clinic_id, auth.uid())
  )
);

CREATE TRIGGER trg_video_sessions_updated
BEFORE UPDATE ON public.video_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.video_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_session_id uuid NOT NULL REFERENCES public.video_sessions(id) ON DELETE CASCADE,
  daily_recording_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  duration_seconds int,
  file_size_bytes bigint,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_recordings_session ON public.video_recordings(video_session_id);

ALTER TABLE public.video_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access recordings via session ownership"
ON public.video_recordings FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.video_sessions vs
    WHERE vs.id = video_session_id
      AND (
        vs.therapist_user_id = auth.uid()
        OR (vs.clinic_id IS NOT NULL AND (
          public.is_clinic_org_owner(vs.clinic_id, auth.uid())
          OR public.is_clinic_org_member(vs.clinic_id, auth.uid())
        ))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.video_sessions vs
    WHERE vs.id = video_session_id
      AND vs.therapist_user_id = auth.uid()
  )
);

CREATE TRIGGER trg_video_recordings_updated
BEFORE UPDATE ON public.video_recordings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.video_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.video_recordings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing',
  language text DEFAULT 'pt',
  text text,
  speakers_json jsonb,
  provider text DEFAULT 'elevenlabs',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_transcriptions_recording ON public.video_transcriptions(recording_id);

ALTER TABLE public.video_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access transcriptions via session ownership"
ON public.video_transcriptions FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.video_recordings vr
    JOIN public.video_sessions vs ON vs.id = vr.video_session_id
    WHERE vr.id = recording_id
      AND (
        vs.therapist_user_id = auth.uid()
        OR (vs.clinic_id IS NOT NULL AND (
          public.is_clinic_org_owner(vs.clinic_id, auth.uid())
          OR public.is_clinic_org_member(vs.clinic_id, auth.uid())
        ))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.video_recordings vr
    JOIN public.video_sessions vs ON vs.id = vr.video_session_id
    WHERE vr.id = recording_id
      AND vs.therapist_user_id = auth.uid()
  )
);

CREATE TRIGGER trg_video_transcriptions_updated
BEFORE UPDATE ON public.video_transcriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public lookup for patient by token
CREATE OR REPLACE FUNCTION public.get_video_session_for_patient(_token text)
RETURNS TABLE (
  id uuid,
  daily_room_url text,
  daily_room_name text,
  status text,
  recording_enabled boolean,
  patient_consented_at timestamptz,
  patient_name text,
  therapist_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    vs.id,
    vs.daily_room_url,
    vs.daily_room_name,
    vs.status,
    vs.recording_enabled,
    vs.patient_consented_at,
    p.name AS patient_name,
    COALESCE(prof.name, 'Terapeuta') AS therapist_name
  FROM public.video_sessions vs
  JOIN public.patients p ON p.id = vs.patient_id
  LEFT JOIN public.profiles prof ON prof.user_id = vs.therapist_user_id
  WHERE vs.patient_access_token = _token
    AND vs.status IN ('scheduled', 'active');
$$;

CREATE OR REPLACE FUNCTION public.record_video_consent(_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated int;
BEGIN
  UPDATE public.video_sessions
  SET patient_consented_at = COALESCE(patient_consented_at, now()),
      updated_at = now()
  WHERE patient_access_token = _token
    AND status IN ('scheduled', 'active');
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;