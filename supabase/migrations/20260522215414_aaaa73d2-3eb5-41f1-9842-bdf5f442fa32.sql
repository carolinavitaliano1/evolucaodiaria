
ALTER TABLE public.video_recordings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_recordings;
