
CREATE TABLE public.therapy_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  payment_pending BOOLEAN NOT NULL DEFAULT false,
  mood_score INTEGER,
  positive_feelings TEXT[] NOT NULL DEFAULT '{}',
  negative_feelings TEXT[] NOT NULL DEFAULT '{}',
  suicidal_thoughts BOOLEAN NOT NULL DEFAULT false,
  notes_text TEXT NOT NULL DEFAULT '',
  action_plans TEXT NOT NULL DEFAULT '',
  next_session_notes TEXT NOT NULL DEFAULT '',
  general_comments TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own therapy sessions"
  ON public.therapy_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_therapy_sessions_updated_at
  BEFORE UPDATE ON public.therapy_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
