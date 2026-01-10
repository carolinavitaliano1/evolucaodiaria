-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  professional_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stamps table for multiple stamps per user
CREATE TABLE public.stamps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  clinical_area TEXT NOT NULL,
  stamp_image TEXT,
  signature_image TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Stamps policies
CREATE POLICY "Users can view their own stamps"
ON public.stamps FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stamps"
ON public.stamps FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stamps"
ON public.stamps FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stamps"
ON public.stamps FOR DELETE
USING (auth.uid() = user_id);

-- Add stamp_id to evolutions to track which stamp was used
ALTER TABLE public.evolutions ADD COLUMN stamp_id UUID REFERENCES public.stamps(id);

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stamps_updated_at
BEFORE UPDATE ON public.stamps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();