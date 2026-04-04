ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.therapeutic_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS participants_data jsonb DEFAULT '{}'::jsonb;