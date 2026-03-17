
-- Enable realtime for portal-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_notices;

-- Enable REPLICA IDENTITY FULL on portal_messages so filtered subscriptions work
ALTER TABLE public.portal_messages REPLICA IDENTITY FULL;
