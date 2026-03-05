
CREATE TABLE public.custom_moods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  label TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom moods" ON public.custom_moods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own custom moods" ON public.custom_moods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own custom moods" ON public.custom_moods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own custom moods" ON public.custom_moods FOR DELETE USING (auth.uid() = user_id);
