
CREATE TABLE public.psicomotor_milestone_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  user_id UUID NOT NULL,
  milestone_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nao_avaliado',
  notes TEXT,
  assessed_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, milestone_key)
);

ALTER TABLE public.psicomotor_milestone_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own milestone tracking"
ON public.psicomotor_milestone_tracking FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own milestone tracking"
ON public.psicomotor_milestone_tracking FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own milestone tracking"
ON public.psicomotor_milestone_tracking FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own milestone tracking"
ON public.psicomotor_milestone_tracking FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_psicomotor_milestone_tracking_updated_at
BEFORE UPDATE ON public.psicomotor_milestone_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_psicomotor_milestone_tracking_patient ON public.psicomotor_milestone_tracking(patient_id);
