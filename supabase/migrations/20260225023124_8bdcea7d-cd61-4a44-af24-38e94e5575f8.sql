
-- Create evolution_templates table
CREATE TABLE public.evolution_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own templates" ON public.evolution_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates" ON public.evolution_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON public.evolution_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON public.evolution_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Add template_data column to evolutions for storing filled template fields
ALTER TABLE public.evolutions ADD COLUMN template_id UUID REFERENCES public.evolution_templates(id) ON DELETE SET NULL;
ALTER TABLE public.evolutions ADD COLUMN template_data JSONB;
