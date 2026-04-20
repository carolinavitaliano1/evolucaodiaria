CREATE TABLE public.calendar_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'feriado',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar blocks"
ON public.calendar_blocks
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_calendar_blocks_user_dates ON public.calendar_blocks(user_id, start_date, end_date);

CREATE TRIGGER update_calendar_blocks_updated_at
BEFORE UPDATE ON public.calendar_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();