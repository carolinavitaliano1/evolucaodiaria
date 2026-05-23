ALTER TABLE public.video_sessions
  ADD COLUMN IF NOT EXISTS recording_layout text NOT NULL DEFAULT 'audio'
  CHECK (recording_layout IN ('audio','video'));