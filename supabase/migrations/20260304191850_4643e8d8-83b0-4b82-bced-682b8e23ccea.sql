
CREATE TABLE public.notice_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, notice_id)
);

ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reads"
  ON public.notice_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reads"
  ON public.notice_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reads"
  ON public.notice_reads FOR DELETE
  USING (auth.uid() = user_id);
