ALTER TABLE public.video_sessions
ADD COLUMN therapy_session_id uuid REFERENCES public.therapy_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_video_sessions_therapy_session_id
ON public.video_sessions(therapy_session_id);