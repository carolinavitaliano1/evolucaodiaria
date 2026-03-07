
-- Allow support admins to view ALL support messages (including from other users)
DROP POLICY IF EXISTS "Support admins can view all messages" ON public.support_messages;

CREATE POLICY "Support admins can view all messages"
ON public.support_messages
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_support_admin = true
  )
);
