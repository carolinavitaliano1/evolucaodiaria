-- Drop the restrictive SELECT policy that only shows notices to owner
DROP POLICY IF EXISTS "Users can view their own notices" ON public.notices;

-- Create new policy: all authenticated users can read all notices
CREATE POLICY "Authenticated users can view all notices"
  ON public.notices
  FOR SELECT
  USING (auth.uid() IS NOT NULL);