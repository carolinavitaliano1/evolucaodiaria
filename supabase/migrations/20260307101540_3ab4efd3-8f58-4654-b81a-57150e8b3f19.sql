-- Add is_support_admin flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_support_admin boolean NOT NULL DEFAULT false;

-- Create support_messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_admin_reply boolean NOT NULL DEFAULT false,
  admin_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages (both sent and admin replies to them)
CREATE POLICY "Users can view their own support messages"
  ON public.support_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can send their own messages
CREATE POLICY "Users can insert their own support messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_admin_reply = false);

-- Admin can view ALL messages
CREATE POLICY "Support admins can view all messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_support_admin = true
    )
  );

-- Admin can insert replies (any user_id, with is_admin_reply = true)
CREATE POLICY "Support admins can insert replies"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    is_admin_reply = true AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_support_admin = true
    )
  );

-- Admin can delete messages
CREATE POLICY "Support admins can delete messages"
  ON public.support_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_support_admin = true
    )
  );