
ALTER TABLE public.evolutions ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.therapeutic_groups(id) ON DELETE SET NULL;
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.therapeutic_groups(id) ON DELETE SET NULL;
