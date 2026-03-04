
CREATE TABLE public.notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'aviso',
  video_url TEXT,
  link_url TEXT,
  link_label TEXT,
  pinned BOOLEAN DEFAULT false,
  color TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notices" ON public.notices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own notices" ON public.notices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notices" ON public.notices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notices" ON public.notices FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
