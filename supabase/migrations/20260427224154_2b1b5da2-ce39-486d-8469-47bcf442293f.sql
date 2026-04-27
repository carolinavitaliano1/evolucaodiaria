ALTER TABLE public.evolutions
  ADD COLUMN IF NOT EXISTS schedule_slot_id uuid,
  ADD COLUMN IF NOT EXISTS session_time time;

CREATE INDEX IF NOT EXISTS idx_evolutions_schedule_slot ON public.evolutions(schedule_slot_id);
CREATE INDEX IF NOT EXISTS idx_evolutions_session_time ON public.evolutions(session_time);