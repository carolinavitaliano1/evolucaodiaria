-- 1. Create contract_templates table for reusable therapist contract models
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Modelo de Contrato',
  body_html TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contract templates"
  ON public.contract_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add therapist signature + template reference to patient_contracts
ALTER TABLE public.patient_contracts
  ADD COLUMN IF NOT EXISTS therapist_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS therapist_signed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS contract_template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL;