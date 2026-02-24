
-- Create clinic_notes table for per-clinic notes
CREATE TABLE public.clinic_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clinic notes" ON public.clinic_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own clinic notes" ON public.clinic_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clinic notes" ON public.clinic_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clinic notes" ON public.clinic_notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_clinic_notes_updated_at BEFORE UPDATE ON public.clinic_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
