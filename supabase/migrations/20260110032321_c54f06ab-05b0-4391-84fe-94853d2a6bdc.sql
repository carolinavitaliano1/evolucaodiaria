-- Create evolutions table
CREATE TABLE public.evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  attendance_status TEXT NOT NULL DEFAULT 'presente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolutions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own evolutions" 
ON public.evolutions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evolutions" 
ON public.evolutions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evolutions" 
ON public.evolutions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evolutions" 
ON public.evolutions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_evolutions_updated_at
BEFORE UPDATE ON public.evolutions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create attachments table for files/images/videos
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_id UUID NOT NULL,
  parent_type TEXT NOT NULL, -- 'evolution', 'clinic'
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own attachments" 
ON public.attachments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attachments" 
ON public.attachments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attachments" 
ON public.attachments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments', 
  'attachments', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
);

-- Storage policies
CREATE POLICY "Users can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);