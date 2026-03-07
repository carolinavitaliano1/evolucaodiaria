
-- Allow support admins to view all profiles (needed to show user info in support chat)
CREATE POLICY "Support admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_support_admin = true
    )
  );
