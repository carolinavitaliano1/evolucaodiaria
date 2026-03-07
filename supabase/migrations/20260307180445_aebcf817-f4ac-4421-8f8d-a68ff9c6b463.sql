
-- Allow support admins to delete sessions (to reopen chats on behalf of users)
CREATE POLICY "Support admins can delete sessions"
  ON public.support_chat_sessions
  FOR DELETE
  USING (public.is_support_admin(auth.uid()));

-- Allow users to delete their own sessions (to reopen their own chat)
CREATE POLICY "Users can delete their own sessions"
  ON public.support_chat_sessions
  FOR DELETE
  USING (auth.uid() = user_id);
