
-- 1. Create questionnaire_templates table
CREATE TABLE public.questionnaire_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.questionnaire_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own questionnaire templates"
  ON public.questionnaire_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Create patient_questionnaires table
CREATE TABLE public.patient_questionnaires (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.questionnaire_templates(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL,
  portal_account_id uuid REFERENCES public.patient_portal_accounts(id) ON DELETE CASCADE,
  therapist_user_id uuid NOT NULL,
  title text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist can manage patient questionnaires"
  ON public.patient_questionnaires FOR ALL
  TO authenticated
  USING (therapist_user_id = auth.uid())
  WITH CHECK (therapist_user_id = auth.uid());

CREATE POLICY "Portal patient can view and answer own questionnaires"
  ON public.patient_questionnaires FOR ALL
  TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()))
  WITH CHECK (is_portal_patient(patient_id, auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_questionnaire_templates_updated_at
  BEFORE UPDATE ON public.questionnaire_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_questionnaires_updated_at
  BEFORE UPDATE ON public.patient_questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
