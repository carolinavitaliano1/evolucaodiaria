
-- Create table to track closed support chat sessions
CREATE TABLE public.support_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  closed_by TEXT NOT NULL DEFAULT 'user',
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_count INTEGER NOT NULL DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE public.support_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions; admins can view all
CREATE POLICY "Users and admins can view sessions"
  ON public.support_chat_sessions FOR SELECT
  USING (
    (auth.uid() = user_id) OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_support_admin = true))
  );

-- Any authenticated user can insert sessions
CREATE POLICY "Authenticated users can insert sessions"
  ON public.support_chat_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
