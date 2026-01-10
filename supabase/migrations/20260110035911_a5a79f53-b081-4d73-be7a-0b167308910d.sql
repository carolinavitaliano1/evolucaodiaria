-- Add avatar column to profiles
ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own stamps" ON public.stamps;
DROP POLICY IF EXISTS "Users can create their own stamps" ON public.stamps;
DROP POLICY IF EXISTS "Users can update their own stamps" ON public.stamps;
DROP POLICY IF EXISTS "Users can delete their own stamps" ON public.stamps;

-- Create permissive policies for profiles (until auth is implemented)
CREATE POLICY "Allow all profile operations"
ON public.profiles FOR ALL
USING (true)
WITH CHECK (true);

-- Create permissive policies for stamps (until auth is implemented)
CREATE POLICY "Allow all stamp operations"
ON public.stamps FOR ALL
USING (true)
WITH CHECK (true);