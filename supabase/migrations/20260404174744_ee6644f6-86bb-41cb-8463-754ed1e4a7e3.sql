
-- Session plans table
CREATE TABLE public.session_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  objectives TEXT DEFAULT '',
  activities TEXT DEFAULT '',
  external_links JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own session plans"
  ON public.session_plans FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add plan_id to therapy_sessions to link session to a plan
ALTER TABLE public.therapy_sessions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL;
