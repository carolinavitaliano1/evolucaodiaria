
-- Table for custom questions defined by therapist
CREATE TABLE public.intake_custom_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'textarea', 'select', 'yesno'
  options JSONB DEFAULT '[]'::jsonb,        -- for 'select' type: array of strings
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_custom_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own custom questions"
  ON public.intake_custom_questions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_intake_custom_questions_updated_at
  BEFORE UPDATE ON public.intake_custom_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add custom_answers column to patient_intake_forms
ALTER TABLE public.patient_intake_forms
  ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb;
