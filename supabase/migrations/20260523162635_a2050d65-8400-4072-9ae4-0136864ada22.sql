
CREATE TABLE public.psico_anamnese (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  user_id UUID NOT NULL,
  escolar JSONB NOT NULL DEFAULT '{}'::jsonb,
  familiar JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);

ALTER TABLE public.psico_anamnese ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view anamnese"
ON public.psico_anamnese FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert anamnese"
ON public.psico_anamnese FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update anamnese"
ON public.psico_anamnese FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete anamnese"
ON public.psico_anamnese FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_psico_anamnese_updated_at
BEFORE UPDATE ON public.psico_anamnese
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_psico_anamnese_patient ON public.psico_anamnese(patient_id);
