
-- Fix: drop the recursive policy that caused infinite recursion
DROP POLICY IF EXISTS "Support admins can view all profiles" ON public.profiles;

-- Create a SECURITY DEFINER function to check support admin status
-- (bypasses RLS to avoid self-referencing recursion)
CREATE OR REPLACE FUNCTION public.is_support_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND is_support_admin = true
  );
$$;

-- Recreate the policy using the safe function (no more recursion)
CREATE POLICY "Support admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_support_admin(auth.uid()));
