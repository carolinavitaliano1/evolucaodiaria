
-- Table for patient portal activities (action plans sent by therapist)
CREATE TABLE public.portal_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  therapist_user_id UUID NOT NULL,
  portal_account_id UUID REFERENCES public.patient_portal_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_activities ENABLE ROW LEVEL SECURITY;

-- Therapist can manage their own activities
CREATE POLICY "Therapist can manage portal activities"
  ON public.portal_activities FOR ALL
  TO authenticated
  USING (therapist_user_id = auth.uid())
  WITH CHECK (therapist_user_id = auth.uid());

-- Portal patient can view and update own activities
CREATE POLICY "Portal patient can view own activities"
  ON public.portal_activities FOR SELECT
  TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()));

CREATE POLICY "Portal patient can update own activities"
  ON public.portal_activities FOR UPDATE
  TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_activities;
