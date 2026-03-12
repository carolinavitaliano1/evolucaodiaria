
-- Create feed_media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('feed_media', 'feed_media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feed_media
CREATE POLICY "Feed media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'feed_media');

CREATE POLICY "Therapists can upload feed media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'feed_media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Therapists can update feed media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'feed_media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Therapists can delete feed media"
ON storage.objects FOR DELETE
USING (bucket_id = 'feed_media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create feed_posts table
CREATE TABLE public.feed_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT, -- 'image', 'video', 'link'
  link_url TEXT,
  link_title TEXT,
  link_description TEXT,
  link_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist can manage own feed posts"
ON public.feed_posts FOR ALL
TO authenticated
USING (therapist_id = auth.uid())
WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "Portal patient can view own feed posts"
ON public.feed_posts FOR SELECT
TO authenticated
USING (is_portal_patient(patient_id, auth.uid()));

-- Create feed_comments table
CREATE TABLE public.feed_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_type TEXT NOT NULL DEFAULT 'therapist', -- 'therapist' or 'patient'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist can manage own feed comments"
ON public.feed_comments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feed_posts
    WHERE feed_posts.id = feed_comments.post_id
    AND feed_posts.therapist_id = auth.uid()
  )
);

CREATE POLICY "Comment author can manage own comments"
ON public.feed_comments FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Portal patient can view and add comments on own posts"
ON public.feed_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_comments.post_id
    AND is_portal_patient(fp.patient_id, auth.uid())
  )
);

CREATE POLICY "Portal patient can insert comments on own posts"
ON public.feed_comments FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = post_id
    AND is_portal_patient(fp.patient_id, auth.uid())
  )
);

-- Create feed_reactions table
CREATE TABLE public.feed_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like', -- 'like', 'heart', 'star'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist can view reactions on own posts"
ON public.feed_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feed_posts
    WHERE feed_posts.id = feed_reactions.post_id
    AND feed_posts.therapist_id = auth.uid()
  )
);

CREATE POLICY "Portal patient can manage own reactions"
ON public.feed_reactions FOR ALL
TO authenticated
USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_reactions.post_id
    AND is_portal_patient(fp.patient_id, auth.uid())
  )
)
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = post_id
    AND is_portal_patient(fp.patient_id, auth.uid())
  )
);

CREATE POLICY "Users can manage own reactions"
ON public.feed_reactions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_feed_posts_updated_at
BEFORE UPDATE ON public.feed_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
