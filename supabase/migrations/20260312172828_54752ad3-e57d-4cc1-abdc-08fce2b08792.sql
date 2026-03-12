
CREATE TABLE IF NOT EXISTS public.evolution_feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  evolution_ids UUID[] NOT NULL DEFAULT '{}',
  content TEXT NOT NULL DEFAULT '',
  photo_urls JSONB NOT NULL DEFAULT '[]',
  sent_to_portal BOOLEAN NOT NULL DEFAULT false,
  is_bulk BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evolution_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own evolution feedbacks"
  ON public.evolution_feedbacks FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_evolution_feedbacks_updated_at
  BEFORE UPDATE ON public.evolution_feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
